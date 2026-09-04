# BU-056 Specification

**BUILD UNIT:** BU-056
**TITLE:** Secure Assessment Exam Instance Attempt Duration Configuration Persistence Bootstrap
**PHASE:** BUILD

## Status
- STAGE 1 SCOPE FREEZE: PASS
- SOURCE AUTHORING: EXECUTED
- CONTROLLER ENGINEERING VERIFICATION: PASS
- FIRST REAL POSTGRESQL VERIFICATION: FAIL — MIGRATION HISTORY ID MISSING
- TARGETED MIGRATION-ID CORRECTION: EXECUTED
- SECOND REAL POSTGRESQL VERIFICATION: FAIL — PROTECTED-SCHEMA VERIFIER PROOF GAP
- TARGETED PROTECTED-SCHEMA VERIFIER REMEDIATION: EXECUTED
- CORRECTED VERIFIER STRICT TYPECHECK: PASS
- FINAL REAL POSTGRESQL VERIFICATION: PASS
- BU-055 REGRESSION: PASS
- DISPOSABLE DATABASE CLEANUP: PASS
- POST-EXECUTION REPOSITORY INTEGRITY: PASS
- CONTROL STATE-SYNC: EXECUTED
- IMPLEMENTATION REPOSITORY FINALIZED: YES / AWAITING CONTROLLER PHYSICAL AUDIT
- STAGE-3 CONTROLLER PHYSICAL AUDIT: NOT YET
- FAST-TRACK LIFECYCLE CLOSE: NOT YET
- DONE: NO
- FULL BU-056 REPOSITORY FINALIZED: NO
- FINAL PHYSICAL VERIFICATION: NOT YET

## Final Engineering Hashes
- **Migration SHA256:** 1BC70DD2549855C586730C48D9E691F788017EE4910FD83147C5D4156A6FA431
- **Verifier SHA256:** D72A1874F1C10E8BA43FE700742E47DB9CF89F2378F5779D1E1A1A7AC55ED136
- **Note:** The final byte-level engineering identity changed only because of targeted pre-commit whitespace hygiene.

## Predecessors
- BU-002 Exam Instance persistence
- BU-007 timer-state semantics
- BU-044 Teaching Assignment context
- BU-053 lifecycle-state persistence
- BU-054 operational-window persistence
- BU-055 DRAFT-to-SCHEDULED transition

## Purpose
Persist the configured nominal Attempt Duration on the Exam Instance as one bounded prerequisite for later READY evaluation and effective Attempt timer resolution.

## Frozen Persistence Contract
**TARGET TABLE:** public.secure_assessment_exam_instances

**ADD EXACTLY ONE COLUMN:**
`configured_attempt_duration_seconds INTEGER NULL`

**DEFAULT:**
NONE

**SEMANTICS:**
- NULL = configured Attempt Duration is not yet established.
- Positive integer = configured nominal working duration for an Attempt, in whole seconds.

**CONSTRAINT:**
Add exact CHECK constraint: `ck_sa_exam_instances_attempt_duration_positive`
Constraint semantics:
`configured_attempt_duration_seconds IS NULL OR configured_attempt_duration_seconds > 0`

## Exact Out-of-Scope
- SCHEDULED -> READY
- READY evaluation / preflight
- READY -> ACTIVE
- any other lifecycle transition
- latest-start policy
- full duration-vs-window policy resolution
- automatic scheduler
- Assessment Type implementation
- Question Snapshot creation/runtime readiness
- participant readiness runtime
- scoring configuration/readiness
- anti-cheating configuration/readiness
- Exam Room readiness
- Proctor readiness
- technical compatibility readiness
- timer-state migration/change
- timer start change
- timer adjustment change
- Attempt creation
- Session creation
- Exam Entry
- API
- UI
- permission matrix
- final RBAC/ABAC rules
- PB05 closure
- BU-057 selection/registration

## PB05
OPEN / CARRIED FORWARD
