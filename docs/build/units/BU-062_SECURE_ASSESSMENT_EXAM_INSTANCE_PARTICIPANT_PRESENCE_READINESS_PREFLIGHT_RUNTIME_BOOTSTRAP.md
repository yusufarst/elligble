# BU-062: Secure Assessment Exam Instance Participant Presence Readiness Preflight Runtime Bootstrap

## TITLE
Secure Assessment Exam Instance Participant Presence Readiness Preflight Runtime Bootstrap

## PURPOSE
Implement the smallest READ-ONLY runtime primitive that evaluates ONLY whether one same-tenant SCHEDULED Secure Assessment Exam Instance has at least one Exam Participant. This is a PARTICIPANT PRESENCE preflight only.

## CANONICAL BASIS
Relevant governance, D04 Secure Assessment, Master Blueprint, architecture, BU-002, BU-050, BU-051, BU-052, BU-053, BU-055, BU-061.

## PREDECESSORS
- BU-002
- BU-050
- BU-051
- BU-052
- BU-053
- BU-055
- BU-061

## EXACT IN-SCOPE CONTRACT
- Bounded read-only preflight runtime to verify participant presence for a specific same-tenant SCHEDULED Exam Instance.
- Accepts `tenantId`, `examInstanceId`, and a generic capability evaluator.
- UUID validation for identifiers.
- Authorization contextual evaluation.
- Returns discriminated semantic unions: `participant_presence_ready` (with exact count >= 1), `not_ready` (with `participant_empty`), `invalid_state`, `denied`, or `unavailable`.
- Fail-closed database failure handling.

## EXACT OUT-OF-SCOPE
- overall READY evaluator
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- any lifecycle mutation
- Assessment Type readiness aggregation
- Question Snapshot readiness aggregation
- Question Snapshot semantic validity
- participant eligibility evaluation
- Academic Enrollment validity/status evaluation
- participant status taxonomy
- enrollment status taxonomy
- controlled late participant assignment mode
- participant reassignment
- participant deassignment
- participant deletion
- participant creation changes
- participant uniqueness changes
- Attempt creation
- Session creation
- Secure Assessment Entry
- duration/timing readiness
- scoring readiness
- answer-key validation
- anti-cheating readiness
- Exam Room readiness
- Proctor readiness
- device/technical compatibility readiness
- readiness warnings aggregation
- API
- routes
- controllers
- frontend/UI
- migration/schema changes
- package.json changes
- tsconfig changes
- Academic Core mutation
- PB05 closure
- Production Blocker closure
- successor selection
- BU-063 selection

## FOCUSED TEST REQUIREMENTS
- Node:test and Node:assert.
- ESM imports.
- Prove exact behavioral conditions (count 1, count 2, count 0, invalid state, denied evaluator, unavailable evaluator, rejecting evaluator, invalid UUID, wrong tenant, db query failure, no mutation).
- Prove capability evaluator context passing.

## REAL POSTGRESQL VERIFIER REQUIREMENTS
- ESM-safe verifier script.
- Disposable database creation (`elligble_bu062_<runId>`).
- Prove exactly one canonical migration exists for prefixes 0001-0030.
- Apply migrations 0001-0030 sequentially.
- Verify migration history reaches 30.
- Create canonical fixture rows including SCHEDULED Exam Instances (with and without participants) and tenant identities.
- Execute real BU-062 runtime to prove `not_ready` then `participant_presence_ready`.
- Prove wrong tenant yields `denied`.
- Prove non-SCHEDULED yields `invalid_state`.
- Prove participant count does not leak across instances or tenants.
- Prove preservation of BU-051 constraint `uq_sa_exam_participants_tenant_instance_person`.
- Prove no schema mutation.
- Disposable database cleanup and leak detection.
- Emit `REAL POSTGRESQL VERIFICATION: PASS`.

## AUTHORIZED PATH SCOPE
1. `runtime/secure-assessment/src/exam-instance-participant-presence-readiness-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-participant-presence-readiness-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu062_exam_instance_participant_presence_readiness_preflight.ts`
4. `docs/build/units/BU-062_SECURE_ASSESSMENT_EXAM_INSTANCE_PARTICIPANT_PRESENCE_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`
5. `docs/build/BUILD_PHASE_INDEX.md`
6. `docs/state/CURRENT_STATE.md`
7. `docs/state/HANDOFF_PACKET.md`

## STOP CONDITIONS
- Schema/migration change becomes necessary.
- Participant eligibility semantics must be invented.
- Academic Enrollment status semantics must be invented.
- Controlled late-assignment mode must be invented.
- Overall READY must be decided.
- SCHEDULED -> READY mutation becomes necessary.
- PB05 must close.
- BU-061 must be reopened.
- Successor selection becomes necessary.
- Package/tsconfig change becomes necessary.
- Terminal execution becomes necessary.

## STAGE-2 ENGINEERING EVIDENCE
- PACKAGE TYPECHECK: PASS
- FOCUSED TEST: 11 / 11 PASS
- PACKAGE REGRESSION: 145 / 145 PASS
- VERIFIER STRICT TYPECHECK: PASS
- REAL POSTGRESQL VERIFICATION: PASS
- DISPOSABLE DATABASE CLEANUP: PASS
- RUNTIME SHA256: 4CEBDC6FC116FEAD955DCC06032787D951820E1A8A1E14DE9358E2D557DA76CE
- FOCUSED TEST SHA256: DDA79AAA0B85B5A39B4508915B3D897B964F36BCD1BD30FE9B64EFF227E5F394
- VERIFIER SHA256: 917BB800C1CCD7F0CBF41C276CB6FEC6CB4BB8DDFE7DC311D3EC30B4E3380D4E
- CLEANUP VALIDATION: Stale failed-run residue confirmed isolated; current verifier cleanup pass confirmed.

## Execution State
- **STAGE-1 SCOPE FREEZE:** PASS / FROZEN
- **STAGE-2 SOURCE IMPLEMENTATION:** EXECUTED / COMPLETE
- **STAGE-2 ENGINEERING VERIFICATION:** PASS
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-2 FINALIZATION COMMIT:** 0603c644c541538cf9064339001902473131dd93
- **FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL
- **FIRST STAGE-3 FINDING CLASSIFICATION:** CONTROL / LIVE-NAVIGATION / REPOSITORY-FINALIZATION TRUTH DEFECT ONLY | NO ENGINEERING DEFECT ESTABLISHED
- **TARGETED STAGE-3 CONTROL-TRUTH REMEDIATION:** COMPLETE / REPOSITORY FINALIZED
- **TARGETED STAGE-3 REMEDIATION REPOSITORY FINALIZED:** YES
- **PROCESS-TRUTH FORWARD CORRECTION:** COMPLETE / INCLUDED IN TARGETED STAGE-3 REMEDIATION FINALIZATION
- **PROCESS FINDING CLASSIFICATION:** PROCESS CONTROL / EXECUTION-REPORT TRUTH DEFECT | NO ENGINEERING DEFECT ESTABLISHED
- **PRIOR READ-ONLY POWERSHELL Select-String DEVIATION:** RECORDED / PRESERVED
- **PRIOR INCORRECT TERMINAL-COMMAND REPORT:** RECORDED / FORWARD-CORRECTED
- **PRIOR INCORRECT PROCESS-DEVIATION REPORT:** RECORDED / FORWARD-CORRECTED
- **PRIOR BACKGROUND/TASKIFIED STATUS:** ESTABLISHED VIA VISIBLE task-5033.log NOTIFICATION EVIDENCE
- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** NOT YET / NEXT
- **DONE:** NO
- **FULL BU-062 REPOSITORY FINALIZED:** NO
- **FINAL PHYSICAL VERIFICATION:** NOT YET
- **PB05:** OPEN / CARRIED FORWARD
- **SUCCESSOR:** NOT SELECTED / NOT REGISTERED
