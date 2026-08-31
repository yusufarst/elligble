# BU-044 — Secure Assessment Exam Instance Teaching-Assignment Context Persistence Bootstrap

Version: 1.0.0

## PURPOSE
Add the minimum persisted Academic Core Teaching Assignment reference required for a teacher-managed Secure Assessment Exam Instance. This BU creates only the persistence bridge.

## PREDECESSORS
- BU-043 (fully closed predecessor authorization-context work)
- BU-002 (owns existing Exam Instance persistence baseline)
- BU-042 (owns Teaching Assignment persistence truth)

## CANONICAL SAFETY
- Teacher != Teaching Assignment
- Teacher != Proctor
- context reference != final creation authorization
- PB-05 Permission Matrix remains OPEN
- no Production Blocker closes
- Secure Assessment does not re-own Academic Core truth
- `teaching_assignment_id` is nullable
- revoked Teaching Assignment historical references remain valid
- new teacher-managed creation must later require active authorization context

## EXACT IN-SCOPE
- Addition of `teaching_assignment_id` column to `secure_assessment_exam_instances`
- `fk_sa_exam_instances_teaching_assignment` composite foreign key with `ON DELETE RESTRICT`
- `idx_sa_exam_instances_tenant_teaching_assignment` normal lookup index

## EXACT OUT-OF-SCOPE
- HTTP/API
- frontend/UI
- runtime Exam Instance creation
- assessment lifecycle/status expansion
- Question Bank changes
- Exam Question Snapshot changes
- participant assignment
- answer persistence changes
- timer changes
- submission changes
- Proctor assignment changes
- Teacher = Proctor behavior
- Permission Matrix implementation
- PB-05 closure
- RBAC/ABAC framework
- scoring
- Track integration
- deployment
- production hosting
- BU-045 is out of scope

## PHYSICAL CONTRACT
- Migration 0020
- `secure_assessment_exam_instances.teaching_assignment_id` (UUID NULL)
- FK `(teaching_assignment_id, tenant_id) REFERENCES academic_core_teaching_assignments(id, tenant_id) ON DELETE RESTRICT`
- Index `(tenant_id, teaching_assignment_id)` non-unique.

## HISTORICAL / REVOCATION SEMANTICS
- The FK is referential only.
- It MUST NOT require `revoked_at IS NULL`.
- A historical Exam Instance may continue referencing a Teaching Assignment that is later revoked.
- Active Teaching Assignment validation at assessment-creation time belongs to the BU-043 authorization-context runtime / later creation flow.
- No trigger to enforce active status.

## VERIFICATION REQUIREMENTS
- Structure: column is UUID, nullable, no default. No forbidden model leakage columns.
- FK Contract: Exact tenant-safe FK.
- Index Contract: Exact non-unique index.
- History: 0020 applied exactly once.
- Positive Functional Case: same-tenant Exam Instance can reference Teaching Assignment.
- Null Compatibility: Exam instance with NULL teaching_assignment_id is still valid.
- Cross-Tenant Safety: Exam instance cannot use Teaching Assignment from another tenant.
- Nonexistent Reference: Random/nonexistent Teaching Assignment UUID fails.
- Revoked Historical Reference: Valid Teaching Assignment can be revoked and still referenced by a new/existing Exam Instance.
- ON DELETE RESTRICT: Referenced Teaching Assignment cannot be deleted.
- Many Exams / One Teaching Assignment: Allowed.
- No Academic-Core Mutation: Exam Instance reference update does not mutate `academic_core_teaching_assignments`.
- Predecessor Integrity: BU-002 and BU-042 structures remain intact.
- No Proctor Coupling: Verification does not depend on proctor assignments.

## PRODUCTION BLOCKER RELATIONSHIP
PB-05 (Permission Matrix) remains OPEN. No PB is closed by this BU.

## STATUS
Stage 1 scope freeze complete
Stage 2 implementation executed
REAL POSTGRESQL 18 VERIFICATION PASS / AUTHORIZED FOREGROUND EXECUTION
MIGRATION 0020 REPEAT-SAFETY PASS
MIGRATION 0020 HISTORY COUNT EXACTLY 1
BU-042 REAL-DB PREDECESSOR REGRESSION PASS
DISPOSABLE DATABASE CLEANUP PASS
POST-DB NEW-FILE HYGIENE PASS
CONTROL DOC STATE-SYNC EXECUTED
FINAL PRE-COMMIT PHYSICAL AUDIT PASS
CONTROLLER PHYSICAL AUDIT PASS
IMPLEMENTATION GIT FINALIZATION COMPLETE
IMPLEMENTATION REPOSITORY FINALIZED YES
FAST-TRACK LIFECYCLE CLOSE COMPLETE
DONE YES
FULL BU-044 REPOSITORY FINALIZED YES
FINAL PHYSICAL VERIFICATION PASS
