# BU-057: Secure Assessment Exam Instance Latest-Start Policy Persistence Bootstrap

**BUILD UNIT:** BU-057
**TITLE:** Secure Assessment Exam Instance Latest-Start Policy Persistence Bootstrap
**PHASE:** BUILD
**STAGE 1 SCOPE FREEZE:** PASS

## Purpose
Persist authoritative per-Exam-Instance latest-start policy as one bounded prerequisite for later READY evaluation and effective Attempt timer resolution. No runtime resolution in this BU.

## Frozen Persistence Contract
**TARGET TABLE:** `public.secure_assessment_exam_instances`

**ADD EXACTLY ONE COLUMN:**
`latest_start_policy TEXT NULL`

**DEFAULT:** NONE

**ALLOWED VALUES:**
- `FULL_DURATION_BEYOND_WINDOW`
- `REMAINING_WINDOW_ONLY`
- `LATE_START_BLOCKED`

**NULL SEMANTICS:**
latest-start policy is not yet configured / timing readiness remains incomplete.

**CONSTRAINT:**
`ck_sa_exam_instances_latest_start_policy`
CHECK constraint enforcing that `latest_start_policy` is NULL or in the allowed values above.

## Predecessors
- BU-053: Exam Instance Lifecycle State Persistence
- BU-054: Exam Instance Operational Window Persistence
- BU-056: Exam Instance Attempt Duration Configuration Persistence

## Verification Requirements
- PostgreSQL real validation of schema and constraint.
- Rejection of invalid latest start policy values.
- Immutability of predecessor configuration (lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds).
- Preservation of protected Academic Core and timer state schemas.

## Exact Out-of-Scope
- SCHEDULED -> READY
- READY evaluation / preflight
- READY -> ACTIVE
- any other lifecycle transition
- effective Attempt duration computation
- latest-start runtime enforcement
- timer-state migration/change
- timer start behavior change
- Attempt creation
- Session creation
- Exam Entry
- Assessment Type implementation
- Question Snapshot creation/runtime readiness
- participant readiness runtime
- scoring configuration/readiness
- anti-cheating configuration/readiness
- Exam Room readiness
- Proctor readiness
- technical compatibility readiness
- participant/rombel/proctor/room schedule conflict detection
- automatic scheduler
- timezone configuration
- API
- UI
- final RBAC/ABAC/Permission Matrix
- PB05 closure
- BU-058 selection/registration

## Lifecycle Status
- **STAGE 1 SCOPE FREEZE:** PASS
- **STAGE 2 IMPLEMENTATION:** REPOSITORY FINALIZED
- **FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL — MIGRATION SEMANTIC REPEAT-SAFETY / INCOMPATIBLE PRE-EXISTING STATE PROOF DEFECT
- **FINDING CLASSIFICATION:** MATERIAL MIGRATION / VERIFICATION DEFECT
- **TARGETED STAGE-3 REMEDIATION:** EXECUTED
- **TARGETED REMEDIATION REPOSITORY FINALIZED:** YES
- **TARGETED REMEDIATION COMMIT:** b0ab1333f0c43e6fccd490155054c17dff152898
- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** PASS
- **PRIOR PROCESS DEFECT:**
  - unauthorized repository-root temp_prompt.txt scratch file was created;
  - prior Agent incorrectly claimed Stage-3 completion / Stage-5 readiness;
  - no history rewrite performed.
- **FAST-TRACK LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 COMMIT:** 923a5d530914ed742a661c9106a58c40948d3d17
- **DONE:** YES
- **FULL BU-057 REPOSITORY FINALIZED:** YES
- **FIRST STAGE-5 FINAL PHYSICAL VERIFICATION:** FAIL — STAGE-4 LIFECYCLE-CLOSE NAVIGATION STATE-SYNC DEFECT
- **STAGE-5 FINDING CLASSIFICATION:** CONTROL / NAVIGATION STATE-SYNC DEFECT | NO ENGINEERING DEFECT ESTABLISHED
- **TARGETED STAGE-5 FINAL-PHYSICAL CONTROL CORRECTION:** EXECUTED
- **TARGETED STAGE-5 CORRECTION REPOSITORY FINALIZED:** YES
- **FINAL PHYSICAL RE-VERIFICATION:** NOT YET
- **FINAL PHYSICAL VERIFICATION:** NOT YET
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** NOT YET AUTHORIZED
- **PB05:** OPEN / CARRIED FORWARD
- **BU-058:** NOT SELECTED / NOT REGISTERED
