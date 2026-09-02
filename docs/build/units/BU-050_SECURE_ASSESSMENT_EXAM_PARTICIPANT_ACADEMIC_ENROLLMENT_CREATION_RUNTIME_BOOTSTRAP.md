# BU-050 — Secure Assessment Exam Participant Academic-Enrollment Creation Runtime Bootstrap

Version: 1.0.0

## PURPOSE

Implement one bounded runtime primitive that creates a new Secure Assessment Exam Participant from a canonically resolved Academic Enrollment context. Secure Assessment consumes Academic Core truth; it does NOT re-own or mutate Academic Core truth.

## PREDECESSORS:
- BU-002
- BU-046
- BU-047
- BU-048
- BU-049

## CANONICAL SAFETY

- Input exactly: tenantId, examInstanceId, academicEnrollmentId
- Caller-supplied personId, membershipId, academicYearId, academicGroupId, academicPeriodId are PROHIBITED
- The primitive MUST use the canonical BU-048 Academic Enrollment context resolver
- participant.person_id must EXACTLY equal the canonical personId resolved from enrollment via BU-048
- Validates UUID syntax for all inputs
- Exam Instance must exist and belong to the SAME tenant
- Atomicity: The primitive detects and denies creation if an exact duplicate (tenant_id, exam_instance_id, person_id) already exists to prevent sequential duplicates. Note: this does not claim concurrency-safe uniqueness (no ON CONFLICT).
- PB05 remains OPEN
- No Production Blocker closes
- "created" does NOT mean final participant RBAC authorization

## EXACT IN-SCOPE

- `runtime/secure-assessment/src/exam-participant-academic-enrollment-creation.ts`
- `runtime/secure-assessment/test/exam-participant-academic-enrollment-creation.test.ts`
- `runtime/secure-assessment/verification/verify_bu050_exam_participant_academic_enrollment_creation.ts`
- `docs/build/units/BU-050_SECURE_ASSESSMENT_EXAM_PARTICIPANT_ACADEMIC_ENROLLMENT_CREATION_RUNTIME_BOOTSTRAP.md`

## RUNTIME RESULT CONTRACT

Returns a discriminated union equivalent in semantics to `created`, `denied`, or `creation_unavailable`.
- Semantics:
  - Valid input, instance exists, context valid, no duplicate -> created
- Failure:
  - invalid UUID -> denied
  - missing/wrong-tenant Exam Instance -> denied
  - duplicate participant -> denied
  - BU-048 denied -> denied
  - BU-048 context_unavailable -> creation_unavailable
  - DB/query failure -> creation_unavailable
  - never leak raw DB errors

## EXACT OUT-OF-SCOPE

- participant reassignment
- participant deassignment
- participant deletion
- participant concurrency-safe uniqueness
- schema migration
- new unique constraint
- Exam Instance status taxonomy
- READY state policy
- ACTIVE state policy
- post-READY high-impact participant-add governance
- post-ACTIVE controlled exception governance
- Secure Assessment Entry orchestration
- Exam Attempt creation
- Exam Session creation
- Question Snapshot
- answer changes
- timer changes
- submission changes
- Exam Room
- participant status taxonomy
- enrollment status taxonomy
- STUDENT RBAC
- Permission Matrix
- generic RBAC/ABAC
- HTTP/API
- frontend/UI
- package/config changes
- deployment
- PB05 closure
- any Production Blocker closure
- BU-051+

## STATUS

Stage 1 scope freeze: PASS
Stage 2 source edit: EXECUTED
First Controller source physical audit: FAIL — BU-048 nested context access defect / invalid Exam Instance verifier fixture / focused-test type-safety + wrong-tenant coverage gaps / verifier no-mutation + raw-DB-failure proof gaps / verifier trailing whitespace
First targeted source/test/verifier remediation: COMPLETE
First Controller source physical re-audit: FAIL — focused test retained non-type-only pg imports under verbatimModuleSyntax and wrong-tenant Exam Instance test did not physically prove tenant-scoped query SQL/parameters
Second targeted focused-test remediation: COMPLETE
Second Controller source physical re-audit: FAIL — residual focused-test trailing whitespace detected on whitespace-only lines 171 and 178
Third targeted focused-test whitespace hygiene remediation: COMPLETE
Third Controller source physical re-audit: PASS
Package typecheck: PASS
Focused BU-050 unit test: PASS
Canonical Secure Assessment package regression: PASS
Initial standalone verifier strict-typecheck invocation: FAIL — TS5112 / Controller command invocation only / no source defect
Corrected standalone verifier strict typecheck: PASS
Initial pre-verifier disposable-DB probe invocation: FAIL — Controller inline Node probe invocation only / no source defect
Corrected pre-verifier disposable-DB probe: PASS / COUNT 0
Real PostgreSQL verification: PASS
Post-verifier disposable-DB probe: PASS / COUNT 0
Disposable database cleanup: PASS
Post-execution repository integrity: PASS
Stage 2 execution verification: PASS
First Stage-2 control state-sync / implementation-finalization attempt: STOP — BUILD_PHASE_INDEX duplicate NEXT BUILD UNIT match / Controller script only / no source defect
Second targeted finalization continuation: STOP — over-broad BUILD_PHASE_INDEX navigation tail still contained a historical duplicate NEXT BUILD UNIT block / Controller script only / no source defect
Third targeted finalization continuation: EXECUTED
Control doc state-sync: EXECUTED
Controller physical audit: FAIL — Stage-3 physical audit found predecessor-contract drift: BU-001 was listed instead of frozen BU-002
Targeted Stage-3 predecessor-contract remediation: COMPLETE
Controller physical re-audit: PASS
Implementation Git finalization: COMPLETE
Implementation repository finalized: YES
Fast-Track lifecycle close: COMPLETE
Done: YES
Full BU-050 repository finalized: YES
Final physical verification: NOT YET
PB05: OPEN
