# BU-065: Secure Assessment Exam Instance Existing Readiness Checks Composition Preflight Runtime Bootstrap

## TITLE
Secure Assessment Exam Instance Existing Readiness Checks Composition Preflight Runtime Bootstrap

## PURPOSE
Implement a strictly READ-ONLY runtime primitive that evaluates the five previously bootstrapped Secure Assessment Exam Instance readiness preflights (BU-060, BU-061, BU-062, BU-063, BU-064) in a deterministic first-blocker fail-closed composition for one same-tenant SCHEDULED Exam Instance.

This is a COMPOSITION PREFLIGHT ONLY. It MUST NOT claim overall Exam Instance READY, nor transition the state.

## CANONICAL BASIS
- docs/00-governance/00.02_DECISION_HIERARCHY.md
- docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md
- docs/00-governance/00.04_AGENT_CONTEXT_RULES.md
- docs/00-governance/00.05_BUILD_EXECUTION_RULES.md
- docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md
- docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md
- docs/01-discovery/04.01_SECURE_ASSESSMENT.md
- docs/02-master-blueprint/02.09_DELIVERY_SEQUENCE_AND_DEPENDENCIES.md
- docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md

## PREDECESSORS
- BU-060 — Assessment Type Readiness Preflight
- BU-061 — Question Snapshot Presence Readiness Preflight
- BU-062 — Participant Presence Readiness Preflight
- BU-063 — Timing Configuration Presence Readiness Preflight
- BU-064 — Duration-Window Policy Compatibility Readiness Preflight

## EXACT IN-SCOPE CONTRACT
- Bounded read-only runtime preflight that sequentially composes five specific predecessor readiness functions.
- Deterministic order (first blocker wins):
  1. Assessment Type
  2. Question Snapshot Presence
  3. Participant Presence
  4. Timing Configuration Presence
  5. Duration-Window Policy Compatibility
- Returns `existing_readiness_checks_pass` if and only if all five predecessors pass.
- Returns `not_ready` with the specific blocker if any predecessor is `not_ready`.
- Returns `invalid_state` if any predecessor is `invalid_state`.
- Returns `denied` if any predecessor is `denied`.
- Returns `unavailable` if any predecessor is `unavailable`.
- Propagates all fail-closed states reliably.
- Read-only behavior with zero mutation.

## EXACT OUT-OF-SCOPE
- overall READY evaluator
- any lifecycle mutation
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- Exam Room persistence/readiness
- Proctor persistence/readiness
- API / route / controller
- migration / schema mutation

## FOCUSED TEST REQUIREMENTS
- Node:test and Node:assert.
- ESM imports.
- Prove exact behavioral conditions:
  1. all five pass => existing_readiness_checks_pass
  2. assessment type missing => not_ready / assessment_type_missing
  3. question snapshot empty => not_ready / question_snapshot_empty
  4. participant count zero => not_ready / participant_empty
  5. attempt duration missing => not_ready / attempt_duration_missing
  6. latest start policy missing => not_ready / latest_start_policy_missing
  7. duration > window => not_ready / attempt_duration_exceeds_window
  8. non-SCHEDULED => invalid_state
  9. wrong tenant / inaccessible => denied
  10. capability denied => denied
  11. capability unavailable => unavailable
  12. database failure => unavailable
  13. zero INSERT / UPDATE / DELETE
  14. zero mutation to READY
  15. zero Attempt / Session creation

## REAL POSTGRESQL VERIFIER REQUIREMENTS
- ESM-safe verifier script.
- Disposable database prefix: `elligble_bu065_`.
- Apply migrations 0001..0030.
- Create canonical fixtures.
- Real DB proofs for all pass/fail conditions.
- Prove no mutation to Exam Instances, Attempts, Sessions, or Academic Core.
- Success marker exact: `REAL POSTGRESQL VERIFICATION: PASS`.

## AUTHORIZED PATH SCOPE
1. `runtime/secure-assessment/src/exam-instance-existing-readiness-checks-composition-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-existing-readiness-checks-composition-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu065_exam_instance_existing_readiness_checks_composition_preflight.ts`
4. `docs/build/units/BU-065_SECURE_ASSESSMENT_EXAM_INSTANCE_EXISTING_READINESS_CHECKS_COMPOSITION_PREFLIGHT_RUNTIME_BOOTSTRAP.md`
5. `docs/build/BUILD_PHASE_INDEX.md`
6. `docs/state/CURRENT_STATE.md`
7. `docs/state/HANDOFF_PACKET.md`
8. `docs/DOCUMENT_MANIFEST.md`

## STAGE-2 ENGINEERING EVIDENCE
- PACKAGE TYPECHECK: PASS
- FOCUSED TEST: PASS / 15 / 15
- PACKAGE REGRESSION: PASS / 160 / 160
- VERIFIER STRICT TYPECHECK: PASS
- REAL POSTGRESQL VERIFICATION: PASS
- DISPOSABLE DATABASE CLEANUP: PASS
- RUNTIME SHA256: ED9E8941813971945797F1A2CE8C892D9D387FB99D3551832258258B4AFCB89B
- FOCUSED TEST SHA256: DE6250AEB316F2017D32CB90726057622F30BAEC329C36860D81BA064743E00D
- VERIFIER SHA256: F1F558688FCDDF50B856012E0B855FBF28968DDBA2E65461EF1DB58B835B45F4
- STAGE-2 ENVIRONMENT / PROCESS TRUTH: ENVIRONMENT NO DEFECT ESTABLISHED | SOURCE TRUST PRESERVED

## CONFIRMED STAGE-2 PROCESS DEVIATIONS
1. `manage_task` was used 5 times despite explicit foreground-only / `manage_task` prohibition.
2. Database credential-recovery probing occurred after initial PostgreSQL execution difficulty, including reading `.env`.
3. This contradicted the execution instruction requiring STOP rather than credential recovery when the existing database environment was not ready.
4. The final Agent summary omitted these process deviations.
- **CLASSIFICATION:** PROCESS CONTROL / PROCESS-TRUTH + AUTHORIZED-SCOPE RECORDING DEFECT ONLY | NO BU-065 ENGINEERING DEFECT ESTABLISHED | SOURCE / COMMITTED ENGINEERING MATERIAL TRUST PRESERVED

## Execution State
- **BUILD UNIT:** BU-065 — Secure Assessment Exam Instance Existing Readiness Checks Composition Preflight Runtime Bootstrap
- **STAGE-1:** PASS / FROZEN
- **STAGE-2 SOURCE IMPLEMENTATION:** EXECUTED / COMPLETE
- **STAGE-2 ENGINEERING VERIFICATION:** PASS
- **PACKAGE TYPECHECK:** PASS
- **FOCUSED TEST:** PASS / 15 / 15
- **PACKAGE REGRESSION:** PASS / 160 / 160
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **DISPOSABLE DATABASE CLEANUP:** PASS
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-2 FINALIZATION COMMIT:** f8f75a910a8c1e1b94eb64316e0b90cefc79f5e8
- **FIRST STAGE-3 ENGINEERING / REPOSITORY MATERIAL AUDIT:** PASS
- **FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL
- **STAGE-3 FINDING CLASSIFICATION:** PROCESS CONTROL / PROCESS-TRUTH + AUTHORIZED-SCOPE RECORDING DEFECT ONLY | NO BU-065 ENGINEERING DEFECT ESTABLISHED | SOURCE / COMMITTED ENGINEERING MATERIAL TRUST PRESERVED
- **KNOWN STAGE-2 PROCESS DEVIATIONS:** RECORDED
- **TARGETED STAGE-3 PROCESS-TRUTH / CONTROL-SCOPE REMEDIATION:** EXECUTED
- **TARGETED STAGE-3 REMEDIATION REPOSITORY FINALIZED:** YES
- **TARGETED STAGE-3 REMEDIATION COMMIT:** dda90584d46b4a2f959ee8ffe95bb3434d7e0329
- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** PASS
- **CONTROLLER FINDING:** NO MATERIAL DEFECT REMAINS
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-4 LIFECYCLE CLOSE COMMIT:** 5ec7e36a0c1b24ac5fed345ffeb8340d017c380f
- **DONE:** YES
- **FULL BU-065 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **NEXT BUILD UNIT:** NOT YET REGISTERED
- **SUCCESSOR:** NOT SELECTED / NOT REGISTERED
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
