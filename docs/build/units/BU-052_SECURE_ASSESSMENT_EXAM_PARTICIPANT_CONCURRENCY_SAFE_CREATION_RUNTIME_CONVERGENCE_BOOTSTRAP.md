# BU-052 — Secure Assessment Exam Participant Concurrency-Safe Creation Runtime Convergence Bootstrap

Version: 1.0.0

## PURPOSE

Converge the exact logical constraint rejection from PostgreSQL to the domain 'denied' result without leaking raw database errors.

## EXACT PREDECESSORS

- BU-002
- BU-046
- BU-047
- BU-048
- BU-049
- BU-050
- BU-051

## EXACT IN-SCOPE (4 AUTHORIZED PATHS)

1. `runtime/secure-assessment/src/exam-participant-academic-enrollment-creation.ts`
2. `runtime/secure-assessment/test/exam-participant-concurrency-safe-creation.test.ts`
3. `runtime/secure-assessment/verification/verify_bu052_exam_participant_concurrency_safe_creation.ts`
4. `docs/build/units/BU-052_SECURE_ASSESSMENT_EXAM_PARTICIPANT_CONCURRENCY_SAFE_CREATION_RUNTIME_CONVERGENCE_BOOTSTRAP.md`

## RUNTIME CONVERGENCE RULES

Existing public runtime input/result contract remains unchanged.

Only this PostgreSQL insert failure may converge to `denied`:
`code === '23505'` AND `constraint === 'uq_sa_exam_participants_tenant_instance_person'`

Every other DB/query failure remains `creation_unavailable`. A `23505` from any other constraint, or `23505` without exact constraint identity, MUST remain `creation_unavailable`. Raw error details are never exposed.

## VERIFICATION MATRIX

### NEW FOCUSED TEST MUST PROVE
- exact 23505 + exact BU-051 constraint -> denied
- 23505 + different constraint -> creation_unavailable
- 23505 without constraint -> creation_unavailable
- generic insert/query error -> creation_unavailable
- raw error details never leak
- normal successful behavior remains compatible

### NEW REAL-POSTGRESQL VERIFIER MUST
- use disposable DB
- apply exact canonical migration chain 0001..0024
- prove exactly 24 migration history entries
- use real Academic Enrollment + Exam Instance fixtures
- invoke the real runtime primitive
- prove sequential duplicate remains denied
- prove TRUE concurrent same logical creation converges to exactly: 1 created, 1 denied, final matching participant rows = 1
- force/observe the insert-race path sufficiently to prove the loser reaches exact PostgreSQL 23505 constraint `uq_sa_exam_participants_tenant_instance_person`, not merely a later duplicate precheck (via barrier instrumentation that delegates actual SQL to real PostgreSQL and does not alter production runtime/schema)
- prove different Person same Exam Instance remains allowed
- prove same Person different Exam Instance remains allowed
- preserve tenant isolation
- preserve Academic Core no-mutation
- no Attempt creation
- no Session creation
- no raw DB error leak
- robust disposable DB cleanup on PASS and FAIL

## EXACT OUT-OF-SCOPE

- ON CONFLICT
- schema/migration changes
- Participant reassignment/deassignment/deletion
- READY/ACTIVE/status policy
- Secure Assessment Entry
- Exam Attempt creation
- Exam Session creation
- Question Snapshot changes
- answer/timer/submission changes
- Permission Matrix / RBAC / ABAC
- PB05 closure
- HTTP/API/UI
- package/dependency/config/toolchain changes
- deployment
- any fifth Agent-edited path

## SOURCE QUALITY
- no trailing whitespace
- no NUL/control corruption
- preserve TypeScript/package conventions
- no tsx
- no unrelated refactor

## STATUS

Stage 1 scope freeze: PASS
Stage 2 source edit: EXECUTED
Controller semantic source re-audit: PASS
Stage 2 engineering verification: PASS
Implementation repository finalized: YES
Stage 3 Controller Physical Audit: FAIL — BU-052 SPEC INTERNAL LIFECYCLE STATUS CONTRADICTION
Targeted Stage-3 spec status remediation: COMPLETE
Stage 3 Controller Physical Re-Audit: NOT YET
Fast-Track lifecycle close: NOT YET
Done: NO
Final physical verification: NOT YET
PB05: OPEN / CARRIED FORWARD

## STAGE 2 EXECUTION STATUS

**STAGE 1 SCOPE FREEZE:** PASS
**STAGE 2 SOURCE EDIT:** EXECUTED
**CONTROLLER SOURCE / VERIFIER PHYSICAL AUDIT:** PASS
**CONTROLLER VERIFICATION-GUARD FALSE STOPS:** RECORDED / CONTROLLER SCRIPT ONLY / NO PRODUCTION SOURCE DEFECT
**INITIAL VERIFIER WHITESPACE HYGIENE REMEDIATION:** COMPLETE
**EXPLICIT EXAM SESSION ZERO-CREATION PROOF REMEDIATION:** COMPLETE
**FIRST REAL POSTGRESQL VERIFIER:** FAIL — ESM __dirname PATH BOOTSTRAP DEFECT
**TARGETED ESM PATH REMEDIATION:** COMPLETE
**SECOND REAL POSTGRESQL VERIFIER:** FAIL — VERIFIER-OWNED ACADEMIC CORE FIXTURE SNAPSHOT ORDERING DEFECT
**TARGETED ACADEMIC CORE BOUNDED SNAPSHOT REMEDIATION:** COMPLETE
**FINAL VERIFIER WHITESPACE HYGIENE CORRECTION:** COMPLETE
**SECURE ASSESSMENT PACKAGE TYPECHECK:** PASS
**VERIFIER STANDALONE STRICT TYPECHECK:** PASS
**BU-052 FOCUSED UNIT TEST:** PASS / 5 TESTS
**BU-050 FOCUSED UNIT REGRESSION:** PASS / 10 TESTS
**SECURE ASSESSMENT PACKAGE REGRESSION:** PASS / 145 TESTS
**FINAL REAL POSTGRESQL VERIFICATION:** PASS
**TRUE CONCURRENT SAME-LOGICAL-CREATION CONVERGENCE:** PASS / 1 CREATED + 1 DENIED + FINAL ROW COUNT 1
**EXACT LOSER SQLSTATE / CONSTRAINT:** PASS / 23505 / uq_sa_exam_participants_tenant_instance_person
**BU-050 REAL POSTGRESQL REGRESSION:** PASS
**DISPOSABLE DATABASE CLEANUP:** PASS / BU-052 + BU-050 COUNT 0
**POST-EXECUTION SOURCE IMMUTABILITY:** PASS
**STAGE 2 EXECUTION VERIFICATION:** PASS
**CONTROL DOC STATE-SYNC:** EXECUTED
**IMPLEMENTATION GIT FINALIZATION:** COMPLETE
**IMPLEMENTATION REPOSITORY FINALIZED:** YES
**FIRST STAGE 3 CONTROLLER PHYSICAL AUDIT:** FAIL — BU-052 SPEC INTERNAL LIFECYCLE STATUS CONTRADICTION
**TARGETED STAGE-3 SPEC STATUS REMEDIATION:** COMPLETE
**AWAITING STAGE 3 CONTROLLER PHYSICAL RE-AUDIT:** YES
**PB05:** OPEN / CARRIED FORWARD
