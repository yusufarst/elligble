# BU-045 — Secure Assessment Teacher-Managed Exam Instance Creation Runtime Bootstrap

Version: 1.0.0

## PURPOSE
Provide the transactional runtime logic to create a Teacher-Managed Secure Assessment Exam Instance while safely revalidating authorization context.

## PREDECESSORS
- BU-043 (fully closed)
- BU-044 (fully closed)
- BU-042 (Academic Core Teaching Assignment truth)
- BU-002 (Exam Instance baseline)

## CANONICAL SAFETY
- Teacher != Teaching Assignment
- Teacher != Proctor
- active Teaching Assignment required at creation write boundary
- `context_resolved` != final permission
- generic capability evaluator != approved Permission Matrix
- PB05 remains OPEN
- no Production Blocker closes
- Secure Assessment does not mutate/re-own Academic Core
- historical Exam Instance may retain a Teaching Assignment later revoked
- no HTTP/API/UI
- no migration/schema change
- BU-046 out of scope

## EXACT IN-SCOPE
- Runtime implementation for creating a teacher-managed exam instance.
- Safely handling `resolveTeacherManagedAssessmentCreationContext` resolution.
- Transactional revalidation of context before creating the record using `FOR UPDATE` locking.
- Exposing generic hook for an unapproved `AssessmentCreationCapabilityEvaluator`.

## EXACT OUT-OF-SCOPE
- HTTP routes / API layer / controllers
- Defining final permission names or role-to-permission matrices
- Closing PB05
- Migration / Schema modification
- Runtime UI interactions
- Proctor coupling

## RUNTIME CONTRACT
- Generic Evaluator hook decides `granted`, `denied`, or `unavailable`.
- Creation flow evaluates capability after resolving initial context.
- Transactional `SELECT ... FOR UPDATE` ensures no race conditions (e.g., assignment revoked between resolution and insertion).
- Rolls back explicitly on context mismatch.
- Does not expose raw DB exceptions to the consumer.

## AUTHORIZATION/CAPABILITY HOOK BOUNDARY
The capability evaluator is an integration mechanism only. It is intentionally abstract and does not represent an approved Permission Matrix.

## TRANSACTIONAL REVALIDATION / REVOCATION-RACE SAFETY
Revalidation guarantees that a concurrently revoked Teaching Assignment or TEACHER staff assignment will immediately fail the insertion, returning `denied`. This guarantees structural safety around stale capability authorizations.

## VERIFICATION REQUIREMENTS
- Capability granted triggers 1 insertion, mapping tenant and teaching assignment.
- Stale capability authorization races rollback.
- Exceptions safely map to `unavailable`.
- Correct failure mapping for `denied` and `unavailable` evaluator responses.
- Complete type safety around returned unions.
- Real Postgres verification enforces exact persistence output matching BU-044 contract without cross-boundary model mutation.

## PRODUCTION BLOCKER RELATIONSHIP
PB05 Permission Matrix remains OPEN.

## STATUS
Stage 1 scope freeze complete
Stage 2 source implementation executed
SOURCE-SEMANTIC PHYSICAL AUDIT PASS
BU-045 FOCUSED UNIT TEST PASS / 16 TESTS
BU-043 PREDECESSOR FOCUSED REGRESSION PASS / 16 TESTS
COMBINED FOCUSED RUN PASS / 32 TESTS
TYPECHECK PASS
PACKAGE REGRESSION PASS / 145 TESTS
STRICT VERIFIER TYPESCRIPT CHECK PASS
REAL POSTGRESQL 18 VERIFICATION PASS /
AUTHORIZED FOREGROUND EXECUTION
DISPOSABLE DATABASE CLEANUP PASS
POST-DB SOURCE FREEZE PASS
CONTROL DOC STATE-SYNC EXECUTED
FINAL PRE-COMMIT PHYSICAL AUDIT PASS
FIRST CONTROLLER PHYSICAL AUDIT FAIL — HANDOFF LOWER NAVIGATION CONTRADICTION
TARGETED HANDOFF CONTROL REMEDIATION COMPLETE
CONTROLLER PHYSICAL RE-AUDIT PASS
IMPLEMENTATION GIT FINALIZATION COMPLETE
IMPLEMENTATION REPOSITORY FINALIZED YES
FAST-TRACK LIFECYCLE CLOSE COMPLETE
DONE YES
FULL BU-045 REPOSITORY FINALIZED YES
FINAL PHYSICAL VERIFICATION NOT YET
PB05 OPEN
