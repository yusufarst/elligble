# BU-048 — Secure Assessment Exam Participant Academic-Enrollment Assignment Context Runtime Bootstrap

Version: 1.0.0

## PURPOSE

Implement the smallest read-only runtime primitive that resolves the canonical Academic Enrollment / Membership / Person context required by a future Secure Assessment Exam Participant assignment flow. The runtime primitive prevents a caller from treating a caller-supplied Person identity as authoritative for an Academic Enrollment.

## PREDECESSORS:
- BU-001
- BU-046
- BU-047
- existing Secure Assessment runtime foundation

## CANONICAL SAFETY

- Academic Enrollment != Exam Participant
- Student != Exam Participant
- Person != Membership != Academic Enrollment
- Secure Assessment does not re-own Academic Core truth
- personId is resolved through canonical Membership context
- caller-supplied Person identity is not accepted as enrollment authority
- currentness uses only start_date/end_date for this bounded primitive
- Academic Enrollment status taxonomy remains undefined
- no named status such as ACTIVE is introduced
- context_resolved != final participant-assignment authorization
- PB05 remains OPEN
- no Production Blocker closes

## EXACT IN-SCOPE

- `runtime/secure-assessment/src/exam-participant-academic-enrollment-context.ts`
- `runtime/secure-assessment/test/exam-participant-academic-enrollment-context.test.ts`
- `runtime/secure-assessment/verification/verify_bu048_exam_participant_academic_enrollment_context.ts`

## TEMPORAL-CURRENT CONTRACT

An Academic Enrollment is considered eligible if:
- `start_date <= CURRENT_DATE`
- AND `(end_date IS NULL OR end_date >= CURRENT_DATE)`

## RUNTIME RESULT CONTRACT

Returns a discriminated union equivalent in semantics to `context_resolved`, `denied`, or `context_unavailable`.
- Resolves tenantId, personId, membershipId, academicEnrollmentId, academicYearId, academicGroupId, and academicPeriodId on success.
- Returns `denied` for invalid identities, wrong tenant, no matches, multiple matches, or temporally invalid records.
- Returns `context_unavailable` for database/query failures, leaking no raw errors.

## EXACT OUT-OF-SCOPE

- creating Exam Participant rows
- updating existing Exam Participant rows
- setting secure_assessment_exam_participants.academic_enrollment_id
- participant assignment write runtime
- Secure Assessment Entry runtime
- Exam Instance active-state validation
- Exam Attempt creation
- Exam Session creation
- Question Snapshot work
- answer/timer/submission changes
- participant status taxonomy
- Academic Enrollment status taxonomy
- STUDENT RBAC
- final Permission Matrix
- generic RBAC/ABAC framework
- HTTP/API
- UI/frontend
- deployment/hosting
- migration/schema changes
- PB05 closure
- any Production Blocker closure
- BU-049+

## VERIFICATION REQUIREMENTS

- Unit tests must prove deterministic runtime behavior including failure modes.
- Real-DB verification must apply migrations through 0023.
- Real-DB verification must prove correct temporal matching based on Postgres `CURRENT_DATE`.
- Real-DB verification must prove isolation and cleanup.

## PRODUCTION BLOCKER RELATIONSHIP

- PB05 remains OPEN

## STATUS

Stage 1 scope freeze: PASS
Stage 2 source edit: EXECUTED
Controller source physical audit: PASS after targeted verifier remediation
Targeted verifier remediation: COMPLETE
Package typecheck: PASS
Initial standalone verifier typecheck command: FAIL / TS5112 / CONTROLLER INVOCATION ONLY / NO SOURCE DEFECT
Corrected standalone verifier strict typecheck: PASS
Focused unit test: PASS / 6 tests
Secure Assessment package regression: PASS / 145 tests
Verifier syntax check: PASS
Real PostgreSQL verification: PASS
Disposable database cleanup: PASS
Post-execution repository integrity: PASS
Stage 2 execution verification: PASS
Control doc state-sync: EXECUTED
Final pre-commit physical audit: PASS
Controller physical audit: PASS
Implementation Git finalization: COMPLETE
Implementation repository finalized: YES
Fast-Track lifecycle close: COMPLETE
Done: YES
Full BU-048 repository finalized: YES
First final physical verification: FAIL — DOCUMENT_MANIFEST path-format / verifier-row corruption
Targeted final-physical manifest / control correction: COMPLETE
Final physical re-verification: NOT YET
Final physical verification: NOT YET
PB05: OPEN
