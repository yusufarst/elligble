# BUILD UNIT: BU-069

## TITLE
Secure Assessment Exam Instance Baseline Scoring Readiness Preflight Runtime Bootstrap

## STAGE-1
PASS / FROZEN

## PURPOSE
bounded read-only exam-level baseline scoring readiness based on existing immutable Exam Question Snapshots and BU-066 validation authority.

## DIRECT PREDECESSORS
- BU-066
- BU-068

## EXACT RUNTIME CONTRACT
- Invalid tenant UUID -> denied
- Invalid exam UUID -> denied
- Capability evaluator unavailable -> unavailable
- Capability evaluator throws -> unavailable
- Capability not granted -> denied
- Capability evaluator must be invoked once only
- Wrong tenant / inaccessible Exam Instance -> denied
- Raw database exception -> unavailable

Database Read Boundary:
- READ ONLY
- Exam Instance: `lifecycle_state`
- Exam Question Snapshot: `id`, `frozen_content`
- Tenant/exam scope explicit
- Deterministic order: `ORDER BY snapshot.id ASC`
- DO NOT read Question Bank Item content, answers, Attempt, Session, results, Track, Academic Core content.
- DO NOT INSERT / UPDATE / DELETE anything.

Lifecycle Contract:
- Only SCHEDULED may be evaluated.
- Any other lifecycle state -> invalid_state
- BU-069 does NOT transition lifecycle state.

Empty Snapshot Behavior:
- If no Exam Question Snapshots exist -> `not_ready` with blocker `question_snapshot_empty`

Per-Snapshot Scoring Source Validation:
- For each snapshot in stable id order, call `validateBaselineQuestionSnapshotFrozenContent`
- If the validator returns `invalid_content`, stop at the FIRST invalid snapshot.
- Return `not_ready` with `scoring_snapshot_invalid`, exact `snapshotId`, and exact `contentBlocker` from BU-066.
- Do not reinterpret the BU-066 blocker.

Exam-Level Aggregate Scoring Readiness:
- Compute `questionSnapshotCount` and `totalMaxScore`.
- Requires `questionSnapshotCount > 0`, every snapshot valid, `totalMaxScore` finite and > 0.
- If aggregate total becomes non-finite or invalid -> `not_ready` with blocker `total_max_score_invalid`.
- Do not silently clamp, round, normalize, or rescale the total.

## EXACT RESULT UNION
SUCCESS:
```typescript
{
  type: 'baseline_scoring_ready',
  examInstanceId: string,
  tenantId: string,
  questionSnapshotCount: number,
  totalMaxScore: number
}
```

EMPTY:
```typescript
{
  type: 'not_ready',
  blocker: 'question_snapshot_empty'
}
```

INVALID SCORING SOURCE:
```typescript
{
  type: 'not_ready',
  blocker: 'scoring_snapshot_invalid',
  snapshotId: string,
  contentBlocker: BaselineQuestionSnapshotBlocker
}
```

INVALID AGGREGATE:
```typescript
{
  type: 'not_ready',
  blocker: 'total_max_score_invalid'
}
```

OTHER:
```typescript
{ type: 'invalid_state' }
{ type: 'denied' }
{ type: 'unavailable' }
```

## DETERMINISTIC SNAPSHOT ORDERING
Must fetch Exam Question Snapshots using `ORDER BY id ASC`. First blocker in this stable ordering is authoritative.

## AGGREGATE SCORING SEMANTICS
- Must accumulate `maxScore` from all valid snapshots to produce `totalMaxScore` and `questionSnapshotCount`.

## AUTHORIZED PATHS
1. runtime/secure-assessment/src/exam-instance-baseline-scoring-readiness-preflight.ts
2. runtime/secure-assessment/test/exam-instance-baseline-scoring-readiness-preflight.test.ts
3. runtime/secure-assessment/verification/verify_bu069_exam_instance_baseline_scoring_readiness_preflight.ts
4. docs/build/units/BU-069_SECURE_ASSESSMENT_EXAM_INSTANCE_BASELINE_SCORING_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md

## FOCUSED VERIFICATION REQUIREMENTS
- Requires minimum 27 scenarios targeting capability guards, lifecycle state, snapshot validity permutations, BU-066 content blocker propagation, stable ordering, aggregate validation, zero-mutation verification, and exact call counts.

## POSTGRESQL REQUIREMENTS
- Uses a disposable `elligble_bu069_` database.
- Applies canonical migrations 0001 through 0030 ONLY.
- Exact mapping of success, empty, invalid scoring source, and cross-tenant failure paths to the database layer.

## ZERO-MUTATION REQUIREMENTS
- Proves before/after equality around a valid runtime call.
- Validates immutability of Exam Instances, Question Snapshots, Participants, Question Bank items, Attempts, and Sessions.

## FAIL-CLOSED CLEANUP
- Close test DB connection -> Drop DB -> query pg_database to prove absence -> print exact `DISPOSABLE DATABASE CLEANUP: PASS` before `REAL POSTGRESQL VERIFICATION: PASS`. Primary failure must never print PostgreSQL PASS.

## STRICT OUT-OF-SCOPE
- SCHEDULED -> READY
- overall READY evaluator
- READY -> ACTIVE
- Attempt creation
- Session creation
- student Secure Assessment Entry
- answer scoring
- participant result calculation
- result persistence
- result publication
- score scaling
- rounding policy
- negative scoring
- rubric scoring
- essay/manual scoring
- future question types
- Question Bank mutation
- snapshot mutation
- randomization
- anti-cheating policy
- technical/device compatibility
- Exam Room readiness
- Proctor readiness
- Permission Matrix
- Academic Core mutation
- schema/migrations
- API
- frontend
- PB05 closure
- BU-070 selection


## Stage-2 Finalization State (Latest)

This section supersedes the initial execution-state navigation for the current live BU-069 Stage-2 status without rewriting historical authoring text.

- **STAGE-1:** PASS / FROZEN
- **STAGE-2 SOURCE AUTHORING:** EXECUTED / COMPLETE
- **FIRST STAGE-2 ENGINEERING VERIFICATION:** FAIL / PACKAGE TYPECHECK
- **TARGETED RUNTIME TYPECHECK REMEDIATION:** EXECUTED
- **PACKAGE TYPECHECK:** PASS
- **PACKAGE BASELINE REGRESSION:** PASS / 145 / 145
- **BU-066 REGRESSION:** PASS / 23 / 23
- **BU-068 REGRESSION:** PASS / 22 / 22
- **BU-069 FOCUSED TEST:** PASS / 27 / 27
- **COMBINED EXECUTED REGRESSION COVERAGE:** PASS / 217 / 217
- **SECOND STAGE-2 REAL POSTGRESQL VERIFICATION:** FAIL / VERIFIER SNAPSHOT-ID PRIMARY-KEY COLLISION
- **TARGETED VERIFIER SNAPSHOT-ID COLLISION REMEDIATION:** EXECUTED
- **FINAL TARGETED ENGINEERING RE-VERIFICATION:** PASS
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **FIRST CONTROL-STATE FINALIZATION ATTEMPT:** STOP / CONTROLLER SPEC STATUS MATCHER DEFECT
- **CONTROL-STATE FORWARD CORRECTION:** COMPLETE
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL / MATERIAL CAPABILITY-EVALUATOR CONTRACT DRIFT
- **TARGETED CAPABILITY-CONTRACT REMEDIATION:** EXECUTED
- **DONE:** NO
- **FULL BU-069 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-070:** NOT SELECTED / NOT REGISTERED


## Stage-3 Correction Verification / Finalization (Latest)

- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL / MATERIAL CAPABILITY-EVALUATOR CONTRACT DRIFT
- **TARGETED CAPABILITY-CONTRACT REMEDIATION:** EXECUTED
- **FIRST CORRECTION VERIFICATION:** STOP / CAPABILITY LITERAL-WIDENING
- **TARGETED LITERAL-TYPING REMEDIATION:** EXECUTED
- **PACKAGE TYPECHECK:** PASS
- **BU-069 FOCUSED TEST:** PASS / 27 / 27
- **PACKAGE BASELINE:** 145 / 145 / PRESERVED / NOT RERUN
- **BU-066:** 23 / 23 / PRESERVED / NOT RERUN
- **BU-068:** 22 / 22 / PRESERVED / NOT RERUN
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **CORRECTION ENGINEERING VERIFICATION:** PASS
- **CORRECTION REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** PENDING
- **DONE:** NO
- **FULL BU-069 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-070:** NOT SELECTED / NOT REGISTERED
