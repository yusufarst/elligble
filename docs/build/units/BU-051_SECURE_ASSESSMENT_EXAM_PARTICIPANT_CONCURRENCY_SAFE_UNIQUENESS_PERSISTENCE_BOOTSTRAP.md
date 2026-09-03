# BU-051 — Secure Assessment Exam Participant Concurrency-Safe Uniqueness Persistence Bootstrap

Version: 1.0.0

## PURPOSE

Enforce at PostgreSQL persistence level: Within one tenant, one Person may have at most one Exam Participant for one Exam Instance.
Exact logical key: `tenant_id + exam_instance_id + person_id`.
Exact constraint: `CONSTRAINT uq_sa_exam_participants_tenant_instance_person UNIQUE (tenant_id, exam_instance_id, person_id)`.

No partial uniqueness. No status-dependent uniqueness. No READY/ACTIVE-dependent uniqueness.

## EXACT PREDECESSORS

- BU-002
- BU-046
- BU-047
- BU-048
- BU-049
- BU-050

## EXACT IN-SCOPE (7 AUTHORIZED PATHS)

1. `database/migrations/0024_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness.sql`
2. `database/verification/verify_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness.js`
3. `docs/build/units/BU-051_SECURE_ASSESSMENT_EXAM_PARTICIPANT_CONCURRENCY_SAFE_UNIQUENESS_PERSISTENCE_BOOTSTRAP.md`
4. `docs/build/BUILD_PHASE_INDEX.md`
5. `docs/state/CURRENT_STATE.md`
6. `docs/state/HANDOFF_PACKET.md`
7. `docs/DOCUMENT_MANIFEST.md`

## CANONICAL/DOMAIN BASIS & SAFETY

- Explicit pre-existing duplicate detection: Before adding the new UNIQUE constraint, explicitly detect duplicate groups on `tenant_id`, `exam_instance_id`, `person_id`.
- Duplicate Fail-Closed Contract: If a duplicate group exists, the migration MUST fail closed. Do NOT delete, merge, rewrite, or select a surviving row.
- Constraint Semantics: If a constraint with the exact intended name already exists on the canonical target but does not have the exact intended semantics: FAIL CLOSED.
- True Concurrency Verification Contract: A true concurrent race from independent database connections must result in exactly 1 successful authoritative write, 1 rejection with SQLSTATE 23505, and exactly 1 final row.
- Tenant / FK Preservation: 0024 must not drop or alter `fk_sa_participant_instance` or `fk_sa_exam_participants_academic_enrollment`. Tenant boundaries remain strictly enforced.
- Academic Core No-Mutation: 0024 strictly acts on Secure Assessment. Academic Core remains completely unmutated.
- BU-050 Compatibility Boundary: The existing `createExamParticipantAcademicEnrollment` runtime function remains unmodified and functionally compatible with 0024. Natively yields 'created' on success and 'denied' on sequential duplicate.
- Disposable DB Cleanup Requirement: The verification harness must gracefully clean up the disposable database on both PASS and FAIL paths without hanging or improperly exiting.

## VERIFICATION MATRIX

- exact 0001..0023 migration chain: applied exactly 1..23 in order.
- exact migration-history IDs: For every canonical migration 0001 through 0023, migration_id must exactly equal the corresponding migration filename without `.sql`.
- successful 0024 application.
- 0024 repeat safety: safely succeeds again.
- exactly one 0024 history row.
- exact named UNIQUE and ordered columns: `uq_sa_exam_participants_tenant_instance_person` on `tenant_id`, `exam_instance_id`, `person_id`.
- pre-existing duplicate fail-closed with exact rows unchanged.
- direct valid insert: succeeds.
- sequential direct duplicate => 23505 / final count 1.
- true concurrent race => 1 success / 1 x 23505 / final count 1.
- different Person same Exam Instance allowed.
- same Person different Exam Instance allowed.
- wrong-tenant Exam Instance rejected: fails with 23503.
- wrong-tenant Academic Enrollment rejected: fails with 23503.
- predecessor FK definitions unchanged: `fk_sa_participant_instance` and `fk_sa_exam_participants_academic_enrollment` remain structurally identical.
- participant schema breadth unchanged except intended constraint/backing index.
- Academic Core schema/data unchanged by 0024: explicit capture of schema and data before and after 0024.
- BU-050 native compatibility: dynamic import of TS runtime yields created/denied without `tsx`.
- package regression remains required later.
- disposable DB cleanup on PASS and FAIL.
- exact seven-path final audit.

## EXACT OUT-OF-SCOPE

- BU-050 runtime source changes
- ON CONFLICT runtime behavior
- `unique_violation` -> `denied` runtime mapping logic changes
- BU-050 concurrent-call convergence
- participant reassignment, deassignment, or deletion
- READY/ACTIVE/status policy
- Secure Assessment Entry / Exam Attempt / Exam Session creation
- Permission Matrix / RBAC
- PB05 closure
- HTTP/API/UI/deployment
- BU-052+
- Any eighth repository path
- Use of `tsx`

## STOP CONDITIONS

Stop execution if remediation requires:
- any eighth repository path
- BU-050 runtime modification
- package/dependency/config/toolchain change
- tsx
- Academic Core mutation
- predecessor migration modification
- runtime ON CONFLICT
- unique_violation -> denied runtime mapping
- READY/ACTIVE/status policy
- PB05/Permission Matrix resolution
- destructive production data cleanup
- scope expansion
- LOCKED/FROZEN supersession

## STATUS

Stage 1 scope freeze: PASS
Stage 2 source edit: EXECUTED
Targeted semantic remediation: EXECUTED
Controller semantic source re-audit: PASS
Stage 2 engineering verification: PASS
Real PostgreSQL verification: PASS
BU-050 focused PostgreSQL regression: PASS
Secure Assessment typecheck: PASS
Secure Assessment package regression: PASS / 145 TESTS
Disposable database cleanup: PASS
Control doc state-sync: EXECUTED
Implementation Git finalization: COMPLETE
Implementation repository finalized: YES
Stage 3 Controller Physical Audit: PASS
Fast-Track lifecycle close: COMPLETE
Done: YES
Full BU-051 repository finalized: YES
Final physical verification: NOT YET
PB05: OPEN / CARRIED FORWARD
