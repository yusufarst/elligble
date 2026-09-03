# BU-053: Secure Assessment Exam Instance Lifecycle State Persistence Bootstrap

## Purpose
Implement the smallest authoritative persistence foundation for the Secure Assessment Exam Instance lifecycle. Secure Assessment canonically owns Exam Instance state. This BU establishes the locked lifecycle vocabulary for Exam Instances without implementing transition policies or runtimes.

The locked lifecycle semantics are:
- DRAFT
- SCHEDULED
- READY
- ACTIVE
- PAUSED
- ENDED
- FINALIZED
- ARCHIVED

## Canonical Basis
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/00-governance/00.05_BUILD_EXECUTION_RULES.md`
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/02-master-blueprint/02.04_CORE_JOURNEYS_AND_CRITICAL_FLOWS.md`
- `docs/02-master-blueprint/02.09_DELIVERY_SEQUENCE_AND_DEPENDENCIES.md`
- `docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md`
- `docs/build/units/BU-002_SECURE_ASSESSMENT_CORE_STATE_PERSISTENCE_BOOTSTRAP.md`
- `docs/build/units/BU-044_SECURE_ASSESSMENT_EXAM_INSTANCE_TEACHING_ASSIGNMENT_CONTEXT_PERSISTENCE_BOOTSTRAP.md`
- `docs/build/units/BU-045_SECURE_ASSESSMENT_TEACHER_MANAGED_EXAM_INSTANCE_CREATION_RUNTIME_BOOTSTRAP.md`
- `docs/build/units/BU-052_SECURE_ASSESSMENT_EXAM_PARTICIPANT_CONCURRENCY_SAFE_CREATION_RUNTIME_CONVERGENCE_BOOTSTRAP.md`

## Exact Predecessors
- BU-002
- BU-044
- BU-045

**Sequence Gate**: BU-052 terminal / physically verified.

## Exact Agent-Edit Scope
1. `database/migrations/0025_bu053_secure_assessment_exam_instance_lifecycle_state.sql`
2. `database/verification/verify_bu053_secure_assessment_exam_instance_lifecycle_state.js`
3. `docs/build/units/BU-053_SECURE_ASSESSMENT_EXAM_INSTANCE_LIFECYCLE_STATE_PERSISTENCE_BOOTSTRAP.md`

## Migration Contract
Extends `public.secure_assessment_exam_instances` with exactly one new lifecycle field:
`lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT'`

Constraint: `ck_sa_exam_instances_lifecycle_state` enforcing exact accepted values: 'DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'.

Existing rows safely converge to DRAFT since it is the locked non-runnable baseline state. Migration is idempotent and safe to repeat.

## Verifier Requirements
A self-contained real-PostgreSQL verifier proving:
1. canonical migrations 0001 through 0024 apply first;
2. create at least one valid Exam Instance BEFORE migration 0025;
3. apply migration 0025;
4. exact migration history count becomes 25;
5. pre-existing Exam Instance row is now lifecycle_state = 'DRAFT';
6. lifecycle_state physically is: TEXT, NOT NULL, DEFAULT DRAFT;
7. exact CHECK constraint exists: ck_sa_exam_instances_lifecycle_state;
8. new Exam Instance insertion that omits lifecycle_state succeeds and receives DRAFT;
9. every exact allowed state is accepted: DRAFT, SCHEDULED, READY, ACTIVE, PAUSED, ENDED, FINALIZED, ARCHIVED;
10. an invalid value is rejected by real PostgreSQL with code 23514 AND exact constraint ck_sa_exam_instances_lifecycle_state;
11. execute migration 0025 again and prove repeat safety;
12. preserve the current Exam Instance structure established by BU-002 / BU-044;
13. prove BU-053 does NOT introduce schema mutation to: secure_assessment_exam_participants, secure_assessment_exam_attempts, secure_assessment_exam_sessions;
14. prove no Academic Core mutation;
15. disposable database is deleted in PASS and FAIL paths.

## Exact Out-of-Scope
- lifecycle transition runtime
- DRAFT -> SCHEDULED transition
- READY evaluation
- READY transition
- ACTIVE transition
- Exam Instance activation runtime
- schedule/start/end time persistence
- Secure Assessment Entry orchestration
- Exam Attempt creation
- Exam Session creation
- participant reassignment/deletion
- post-READY participant governance
- post-ACTIVE exception governance
- PAUSED runtime semantics
- ENDED/FINALIZED transition logic
- Question Snapshot readiness logic
- Proctor readiness
- Exam Room
- HTTP/API/routes/controllers
- frontend/UI
- Permission Matrix
- RBAC/ABAC policy
- package/dependency/config/toolchain change
- deployment
- PB05 closure
- any Production Blocker closure
- any fourth Agent-edited repository path

## PB05 Status
OPEN / CARRIED FORWARD

## Controller Status
- Stage 1 Controller Unit Selection / Scope Freeze: PASS
- Stage 2 source execution: EXECUTED
- Controller engineering verification: PASS
- Real PostgreSQL verification: PASS
- BU-051 real PostgreSQL regression: PASS
- Disposable database cleanup: PASS
- Post-execution source immutability: PASS
- Control state-sync: EXECUTED / PREPARED FOR CONTROLLED GIT FINALIZATION
- Implementation repository finalized: YES / effective upon the Stage-2 controlled commit+push represented by this state-sync
- Stage 3 Controller Physical Audit: NOT YET
- Fast-Track lifecycle close: NOT YET
- Done: NO
- Final physical verification: NOT YET

## Final Engineering Hashes
- Migration (`database/migrations/0025_bu053_secure_assessment_exam_instance_lifecycle_state.sql`): `D59A312805949BA4B614E7241BCB35223C02601C1208BFC197540345F9C037EF`
- Verifier (`database/verification/verify_bu053_secure_assessment_exam_instance_lifecycle_state.js`): `834E56E7E471B8DF88F281332FEA6DEDE96B459F315665E396C0E816E6260BD3`
