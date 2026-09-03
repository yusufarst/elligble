# BU-054 — Secure Assessment Exam Instance Operational Window Persistence Bootstrap

## Purpose
Add the minimum authoritative Secure Assessment-owned operational Exam Window persistence to `public.secure_assessment_exam_instances`.

This BU creates the persistence prerequisite for a later bounded DRAFT → SCHEDULED lifecycle transition.

BU-054 MUST NOT implement lifecycle transitions.

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
- `docs/build/units/BU-053_SECURE_ASSESSMENT_EXAM_INSTANCE_LIFECYCLE_STATE_PERSISTENCE_BOOTSTRAP.md`

## Exact Predecessors
- BU-002
- BU-044
- BU-045
- BU-053

**Sequence Gate**: BU-053 terminal / final physical verification PASS.

## Exact Agent-Edit Scope
1. `database/migrations/0026_bu054_secure_assessment_exam_instance_operational_window.sql`
2. `database/verification/verify_bu054_secure_assessment_exam_instance_operational_window.js`
3. `docs/build/units/BU-054_SECURE_ASSESSMENT_EXAM_INSTANCE_OPERATIONAL_WINDOW_PERSISTENCE_BOOTSTRAP.md`

## Frozen Persistence Contract
Target table: `public.secure_assessment_exam_instances`

Add exactly:
- `window_starts_at TIMESTAMP WITH TIME ZONE NULL`
- `window_ends_at TIMESTAMP WITH TIME ZONE NULL`

No timestamp default.

DRAFT compatibility:
existing Exam Instances and newly created DRAFT Exam Instances may have:
- `window_starts_at = NULL`
- `window_ends_at = NULL`

A configured operational window must have BOTH values.

Exact CHECK constraints:
1. `ck_sa_exam_instances_window_pair`
```sql
CHECK (
  (window_starts_at IS NULL AND window_ends_at IS NULL)
  OR
  (window_starts_at IS NOT NULL AND window_ends_at IS NOT NULL)
)
```

2. `ck_sa_exam_instances_window_order`
```sql
CHECK (
  window_starts_at IS NULL
  OR
  window_ends_at IS NULL
  OR
  window_starts_at < window_ends_at
)
```

Semantics:
- If a window is configured: `window_starts_at < window_ends_at`
- Equal start/end is invalid.
- Start after end is invalid.
- Partial window is invalid.
- Authoritative instants stored via PostgreSQL `TIMESTAMP WITH TIME ZONE` (timestamptz).
- No tenant timezone field in this BU.
- Default decision is NO NEW INDEX.

### Critical Negative Rule
CONFIGURING A WINDOW MUST NOT AUTOMATICALLY CHANGE `lifecycle_state`.
Valid window + `lifecycle_state` DRAFT = still DRAFT.
BU-054 is persistence only. DRAFT → SCHEDULED runtime is NOT part of this BU.

## Verifier Requirements
A self-contained real-PostgreSQL verifier proving:
1. Apply canonical migrations 0001 through 0025 first.
2. Create at least one valid Exam Instance BEFORE migration 0026.
3. Pre-existing Exam Instance must be DRAFT under BU-053 semantics.
4. Apply migration 0026.
5. Exact migration-history count becomes 26.
6. Physical columns exist: `window_starts_at`, `window_ends_at`.
7. Both columns physically use: `TIMESTAMP WITH TIME ZONE`.
8. Both columns are nullable.
9. Neither column has a timestamp default.
10. Exact CHECK constraint exists: `ck_sa_exam_instances_window_pair`.
11. Exact CHECK constraint exists: `ck_sa_exam_instances_window_order`.
12. Pre-existing Exam Instance converges safely to: `window_starts_at = NULL`, `window_ends_at = NULL` while `lifecycle_state` remains `DRAFT`.
13. New Exam Instance insertion omitting both window columns succeeds.
14. New Exam Instance omitting both window columns receives: `NULL / NULL` and remains `lifecycle_state` `DRAFT`.
15. Valid configured window succeeds with stable explicit timestamptz values (`2026-09-10T08:00:00Z` / `2026-09-10T10:00:00Z`).
16. Valid configured window MUST NOT implicitly change `lifecycle_state`.
17. Start-only partial window is rejected by real PostgreSQL with SQLSTATE 23514 and exact constraint `ck_sa_exam_instances_window_pair`.
18. End-only partial window is rejected by real PostgreSQL with SQLSTATE 23514 and exact constraint `ck_sa_exam_instances_window_pair`.
19. Equal start/end is rejected by real PostgreSQL with SQLSTATE 23514 and exact constraint `ck_sa_exam_instances_window_order`.
20. Start later than end is rejected by real PostgreSQL with SQLSTATE 23514 and exact constraint `ck_sa_exam_instances_window_order`.
21. Execute migration 0026 again and prove repeat safety: no duplicate columns, no duplicate constraints, no duplicate migration-history row, identical resulting schema.
22. Preserve BU-053 lifecycle persistence contract: `lifecycle_state TEXT NOT NULL DEFAULT DRAFT`, exact `ck_sa_exam_instances_lifecycle_state`, exact 8 allowed states remain unchanged.
23. Preserve current Exam Instance tenant and Teaching Assignment structure (BU-002 / BU-044).
24. Prove no schema mutation to: `secure_assessment_exam_participants`, `secure_assessment_exam_attempts`, `secure_assessment_exam_sessions`.
25. Prove no Academic Core schema mutation.
26. Prove no Academic Core DATA mutation.
27. Disposable database cleanup must execute in PASS and FAIL paths.
28. Do NOT falsely claim lifecycle-transition verification.

## Exact Out-of-Scope
- DRAFT → SCHEDULED lifecycle transition runtime
- any other lifecycle transition runtime
- READY evaluation
- READY transition
- ACTIVE transition
- PAUSED / ENDED / FINALIZED / ARCHIVED transition runtime
- automatic lifecycle mutation when a window is written
- Attempt Duration persistence/change
- latest-start policy
- tenant/school timezone configuration
- UI timezone display mechanics
- schedule conflict detection
- Participant overlap conflict detection
- Rombel conflict detection
- Proctor conflict detection
- Exam Room conflict detection
- Secure Assessment Entry orchestration
- Exam Attempt creation
- Exam Session creation
- Question Snapshot readiness
- Question Snapshot creation
- scoring readiness
- anti-cheating readiness
- room/proctor readiness
- Exam Room
- participant reassignment/deletion
- HTTP/API/routes/controllers
- frontend/UI
- Permission Matrix
- RBAC/ABAC policy
- package/dependency/config/toolchain changes
- deployment
- PB05 closure
- any Production Blocker closure
- BU-055 selection or registration
- any fourth Agent-edited path

## PB05 Status
OPEN / CARRIED FORWARD

## Controller Status
- Stage 1 Controller Unit Selection / Scope Freeze: PASS
- Stage 2 source execution: EXECUTED
- Controller engineering verification: PASS
- Real PostgreSQL verification: PASS
- BU-053 real PostgreSQL regression: PASS
- Disposable database cleanup: PASS
- Post-execution source immutability: PASS
- Control state-sync: EXECUTED
- Implementation repository finalized: YES
- Stage 3 Controller Physical Audit: PASS
- Fast-Track lifecycle close: COMPLETE
- Done: YES
- Full BU-054 repository finalized: YES
- Final physical verification: PASS
- PB05: OPEN / CARRIED FORWARD
- Next Build Unit Selection / Scope Freeze: AUTHORIZED

## Final Engineering Hashes
- Migration: 441202B3924EC101ABEE0268A441CFBCE93C8DD89341E409A8F935E7B185520E
- Verifier: 999E510B53C922E2DC1F3FE99E55FB214B1C52CBBB9B05B268CF2206D7ACD04D
