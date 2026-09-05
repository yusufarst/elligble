# BU-061: Secure Assessment Exam Instance Question Snapshot Presence Readiness Preflight Runtime Bootstrap

## TITLE
Secure Assessment Exam Instance Question Snapshot Presence Readiness Preflight Runtime Bootstrap

## PURPOSE
Implement the exact bounded presence-preflight primitive to determine if a SCHEDULED Exam Instance has at least one immutable Exam Question Snapshot, providing a foundational read-only presence check without claiming full question semantic validity or overall exam readiness.

## CANONICAL BASIS
Relevant governance, D04 Secure Assessment, Master Blueprint, architecture, BU-003, BU-053, BU-055, BU-060.

## PREDECESSORS
- BU-003
- BU-053
- BU-055
- BU-060

## EXACT IN-SCOPE CONTRACT
- Bounded read-only preflight runtime to verify question snapshot presence for a specific same-tenant SCHEDULED Exam Instance.
- Accepts `tenantId`, `examInstanceId`, and a generic capability evaluator.
- UUID validation for identifiers.
- Authorization contextual evaluation.
- Returns discriminated semantic unions: `question_snapshot_presence_ready` (with exact count >= 1),`not_ready` (with `question_snapshot_empty`), `invalid_state`, `denied`, or `unavailable`.
- Fail-closed database failure handling.

## EXACT OUT-OF-SCOPE
- SCHEDULED -> READY transition
- overall READY evaluator
- READY -> ACTIVE
- any lifecycle mutation
- Assessment Type readiness aggregation
- schedule/window readiness
- participant readiness
- duration/timing readiness
- scoring readiness
- anti-cheating readiness
- Exam Room readiness
- Proctor readiness
- technical/device compatibility readiness
- Question Snapshot creation runtime
- copying Question Bank Items into snapshots
- question authoring
- question ordering
- randomization
- exam form generation
- frozen_content schema redesign
- frozen_content semantic validation
- answer-key validation
- scoring-key validation
- malformed-content classification
- renderer/device compatibility
- migration/schema change
- Question Bank mutation
- Exam Question Snapshot mutation
- Participant/Attempt/Session creation
- Exam Entry
- API/routes/controllers
- frontend/UI
- PB05 closure
- successor selection
- BU-062 selection

## FOCUSED TEST REQUIREMENTS
- Node:test and Node:assert.
- ESM imports.
- Prove exact behavioral conditions (count 1, count 2, count 0, invalid state, denied evaluator, unavailable evaluator, rejecting evaluator, invalid UUID, wrong tenant, db query failure, no mutation).
- Prove capability evaluator context passing.

## REAL POSTGRESQL VERIFIER REQUIREMENTS
- ESM-safe verifier script.
- Disposable database creation (`elligble_bu061_<runId>`).
- Prove exactly one canonical migration exists for prefixes 0001-0030.
- Apply migrations 0001-0030 sequentially.
- Verify migration history reaches 30.
- Create canonical fixture rows including SCHEDULED Exam Instances (with and without snapshots) and tenant identities.
- Execute real BU-061 runtime to prove`not_ready` then `question_snapshot_presence_ready`.
- Prove wrong tenant yields `denied`.
- Prove non-SCHEDULED yields `invalid_state`.
- Prove no schema mutation and preservation of BU-003 constraints.
- Disposable database cleanup and leak detection.
- Emit `REAL POSTGRESQL VERIFICATION: PASS`.

## AUTHORIZED PATH SCOPE
1.`runtime/secure-assessment/src/exam-instance-question-snapshot-presence-readiness-preflight.ts`
2.`runtime/secure-assessment/test/exam-instance-question-snapshot-presence-readiness-preflight.test.ts`
3.`runtime/secure-assessment/verification/verify_bu061_exam_instance_question_snapshot_presence_readiness_preflight.ts`
4. `docs/build/units/BU-061_SECURE_ASSESSMENT_EXAM_INSTANCE_QUESTION_SNAPSHOT_PRESENCE_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`
5. `docs/build/BUILD_PHASE_INDEX.md`
6. `docs/state/CURRENT_STATE.md`
7. `docs/state/HANDOFF_PACKET.md`

## STOP CONDITIONS
- Schema/migration change becomes necessary.
- frozen_content semantic validity must be invented.
- Scoring/answer-key semantics become necessary.
- Overall READY eligibility must be decided.
- SCHEDULED -> READY mutation becomes necessary.
- Readiness scope expansion.
- PB05 must be closed.
- Any eighth file must change.
- Package/tsconfig change becomes necessary.
- Owner decision becomes necessary.
- Terminal execution becomes necessary.

## STAGE-1
PASS / FROZEN

## OWNER DECISION REQUIRED
NO

## PB05
OPEN / CARRIED FORWARD

## Execution State
- **Stage 1 Controller Unit Selection / Scope Freeze:** PASS / FROZEN
- **Stage 2 Source Implementation:** EXECUTED
- **Targeted ESM Import-Extension Remediation:** COMPLETE
- **Stage 2 Engineering Verification:** PASS
- **Stage 2 Repository Finalized:** YES
- **Stage 2 Finalization Commit:** 30a80295f939763be01823c8586c9cce3bca144e
- **First Stage-3 Controller Physical Audit:** FAIL
- **First Stage-3 Finding Classification:** CONTROL / LIVE-NAVIGATION / REPOSITORY-FINALIZATION TRUTH DEFECT ONLY | NO ENGINEERING DEFECT ESTABLISHED
- **Targeted Stage-3 Control-Truth Remediation:** COMPLETE / REPOSITORY FINALIZED
- **Targeted Stage-3 Remediation Commit:** e8fd0200321d7a3b4135361bdffe7491bd360dbe
- **Targeted Stage-3 Remediation Repository Finalized:** YES
- **Stage-3 Controller Physical Re-Audit:** PASS
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-4 LIFECYCLE CLOSE COMMIT:** 424229c0a82460678a53e5baf8c8ae8c9e080fbe
- **DONE:** YES
- **FULL BU-061 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **PB05:** OPEN / CARRIED FORWARD
- **BU-062:** NOT SELECTED / NOT REGISTERED
