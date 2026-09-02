# BU-049 — Secure Assessment Exam Participant Academic-Enrollment Assignment Write Runtime Bootstrap

Version: 1.0.0

## PURPOSE

Implement the runtime primitive to assign a resolved Academic Enrollment context to a specific Exam Participant. Enforces the strict rule that an assignment may only occur if the participant's person identity exactly matches the canonical person identity sourced from the Academic Enrollment context. The primitive must never silently overwrite a different existing enrollment assignment.

## PREDECESSORS:
- BU-001
- BU-046
- BU-047
- BU-048 (Context Resolver)

## CANONICAL SAFETY

- Input exactly: tenantId, examParticipantId, academicEnrollmentId
- Do not accept caller-supplied: personId, membershipId, examInstanceId as authority
- Use the canonical BU-048 Academic Enrollment context resolver
- participant.person_id must equal the canonical personId resolved from enrollment
- existing participant academic_enrollment_id must be NULL or already equal the requested enrollment
- Atomicity: The final UPDATE must fail closed against conflicting existing assignment
- PB05 remains OPEN
- No Production Blocker closes
- assigned does NOT mean final participant-assignment RBAC authorization

## EXACT IN-SCOPE

- `runtime/secure-assessment/src/exam-participant-academic-enrollment-assignment.ts`
- `runtime/secure-assessment/test/exam-participant-academic-enrollment-assignment.test.ts`
- `runtime/secure-assessment/verification/verify_bu049_exam_participant_academic_enrollment_assignment.ts`
- `docs/build/units/BU-049_SECURE_ASSESSMENT_EXAM_PARTICIPANT_ACADEMIC_ENROLLMENT_ASSIGNMENT_WRITE_RUNTIME_BOOTSTRAP.md`

## RUNTIME RESULT CONTRACT

Returns a discriminated union equivalent in semantics to `assigned`, `denied`, or `assignment_unavailable`.
- Semantics:
  - NULL -> requested enrollment = assigned
  - already same enrollment = assigned / idempotent
  - different non-null enrollment = denied
  - no reassignment
  - no deassignment
- Failure:
  - invalid UUID -> denied
  - missing/wrong-tenant participant -> denied
  - person mismatch -> denied
  - BU-048 denied -> denied
  - BU-048 context_unavailable -> assignment_unavailable
  - DB/query failure -> assignment_unavailable
  - never leak raw DB errors

## EXACT OUT-OF-SCOPE

- creating Exam Participant rows
- reassignment/deassignment
- Exam Instance active-state validation
- Secure Assessment Entry
- Exam Attempt creation
- Exam Session creation
- Question Snapshot
- answer/timer/submission changes
- participant/enrollment status taxonomy
- STUDENT RBAC
- Permission Matrix finalization
- generic RBAC/ABAC
- HTTP/API
- UI/frontend
- migration/schema
- package/config changes
- deployment
- PB05 closure
- any Production Blocker closure
- BU-050+

## STATUS

Stage 1 scope freeze: PASS
Stage 2 source edit: EXECUTED
First Controller source physical audit: FAIL — ESM namespace mock incompatibility / verifier cleanup + migration-chain + wrong-tenant / mutation-proof gaps
First targeted source / verifier remediation: COMPLETE
First Controller source physical re-audit: FAIL — residual focused-test query-order proof / explicit successful-context wrong-participant-tenant no-mutation proof gaps
Second targeted test / verifier remediation: COMPLETE
Second Controller source physical re-audit: FAIL — verifier accessed BU-048 context_resolved fields at result-union level instead of nested context
Third targeted verifier remediation: COMPLETE
Third Controller source physical re-audit: PASS
Stage 2 package typecheck: PASS
Stage 2 standalone verifier strict typecheck: PASS
Stage 2 focused test: PASS — 11/11
Non-canonical all-test discovery: FAIL — 409/410; classified as unrelated pre-existing test-harness issue, not BU-049
Canonical Secure Assessment package regression: PASS — 145/145
First real PostgreSQL verifier execution: FAIL — verifier Exam Instance fixture referenced nonexistent display_label/is_active columns
Failed-run disposable database cleanup: PASS
Fourth targeted verifier remediation: COMPLETE
Fourth Controller source physical re-audit: PASS
Corrected verifier strict typecheck after fourth remediation: PASS
Final real PostgreSQL verifier execution: PASS
Verifier process exit code: 0
Verifier-internal disposable database cleanup: PASS
Post-verifier disposable database absence: PASS — count 0
Post-execution repository integrity: PASS
Combined BU-049 Stage-2 execution verification: PASS
Control doc state-sync: EXECUTED
First final pre-commit physical audit: FAIL — staged diff check detected trailing whitespace in BU-049 focused test / verifier
Targeted pre-commit whitespace hygiene correction: COMPLETE — non-semantic only; prior execution evidence preserved
Final pre-commit physical re-audit: PASS
Controller physical audit: PASS
Implementation Git finalization: COMPLETE
Implementation repository finalized: YES
Fast-Track lifecycle close: COMPLETE
Done: YES
Full BU-049 repository finalized: YES
First final physical verification: FAIL — residual lower CURRENT_STATE navigation prematurely authorized NEXT BUILD UNIT SELECTION / SCOPE FREEZE
Targeted final-physical CURRENT_STATE / control correction: COMPLETE
Final physical re-verification: PASS
Final physical verification: PASS

PB05 remains OPEN.
