# BU-055 — Secure Assessment Exam Instance Draft-to-Scheduled Lifecycle Transition Runtime Bootstrap

## Purpose
Implement the smallest transactional runtime primitive that explicitly transitions one tenant-scoped Secure Assessment Exam Instance:
`DRAFT -> SCHEDULED`
only when its authoritative operational window is valid.

This is NOT READY evaluation and NOT exam activation.

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
- `docs/build/units/BU-054_SECURE_ASSESSMENT_EXAM_INSTANCE_OPERATIONAL_WINDOW_PERSISTENCE_BOOTSTRAP.md`

## Exact Predecessors
- BU-002
- BU-044
- BU-045
- BU-053
- BU-054

**Sequence Gate**: BU-054 terminal / final physical verification PASS.

## Exact Agent-Edit Scope
1. `runtime/secure-assessment/src/exam-instance-draft-to-scheduled-transition.ts`
2. `runtime/secure-assessment/test/exam-instance-draft-to-scheduled-transition.test.ts`
3. `runtime/secure-assessment/verification/verify_bu055_exam_instance_draft_to_scheduled_transition.ts`
4. `docs/build/units/BU-055_SECURE_ASSESSMENT_EXAM_INSTANCE_DRAFT_TO_SCHEDULED_LIFECYCLE_TRANSITION_RUNTIME_BOOTSTRAP.md`

## Frozen Runtime Contract
Target table:
`public.secure_assessment_exam_instances`

Required preconditions:
- matching `tenant_id`
- matching Exam Instance `id`
- `lifecycle_state` exactly `DRAFT`
- `window_starts_at IS NOT NULL`
- `window_ends_at IS NOT NULL`
- `window_starts_at < window_ends_at`

Successful result:
- exactly one Exam Instance transitions `DRAFT -> SCHEDULED`
- `tenant_id` unchanged
- `teaching_assignment_id` unchanged
- `window_starts_at` unchanged
- `window_ends_at` unchanged
- no other Exam Instance fields are mutated

Database transaction:
- Lock and revalidate target Exam Instance at write boundary via `SELECT ... FOR UPDATE`.
- Concurrent / repeated scheduling requests converge safely: once row is `SCHEDULED`, repeat returns `invalid_state` and does NOT behave as a new successful transition.
- Discriminated result union: `scheduled`, `denied`, `invalid_state`, `invalid_window`, `unavailable`.
- Raw DB exceptions never leak as normal public success result.
- Wrong tenant / inaccessible target does not create cross-tenant mutation.

## Authorization Boundary
- PB05 Permission Matrix remains OPEN.
- Do NOT invent final permission names, role matrices, RBAC, or ABAC policy.
- Generic capability-evaluator hook analogous to teacher-managed assessment runtime patterns (`granted` | `denied` | `unavailable`).
- Generic hook != approved Permission Matrix.
- Teacher authority is NOT coupled to Proctor authority.

## Focused Test Requirements
1. DRAFT + valid window + granted authorization -> scheduled.
2. resulting lifecycle_state is exactly SCHEDULED.
3. operational-window values remain unchanged.
4. tenant / Teaching Assignment context remains unchanged.
5. DRAFT + NULL/NULL window -> invalid_window and remains DRAFT.
6. non-DRAFT -> invalid_state and no mutation.
7. denied authorization -> denied and no mutation.
8. unavailable authorization/dependency -> unavailable and no mutation.
9. wrong tenant/inaccessible target -> no cross-tenant mutation.
10. repeated transition after success does not create a second success.
11. raw DB errors do not leak as successful state.

## Real PostgreSQL Verifier Requirements
A disposable real PostgreSQL verifier proving:
1. Apply canonical migrations 0001..0026 in sequence.
2. Create valid Academic Core / tenant / Teaching Assignment fixture.
3. Create DRAFT Exam Instance with valid BU-054 window.
4. Execute real BU-055 runtime and prove DRAFT -> SCHEDULED.
5. Prove exact persisted lifecycle state.
6. Prove window timestamps unchanged.
7. Prove tenant / Teaching Assignment context unchanged.
8. Prove NULL/NULL window cannot schedule.
9. Prove non-DRAFT states cannot schedule.
10. Prove tenant mismatch cannot mutate another tenant's row.
11. Prove repeat/retry after success does not produce a second transition.
12. Prove concurrent requests converge safely.
13. Preserve BU-054 window constraints.
14. Preserve BU-053 lifecycle constraint and exact 8 allowed states.
15. Zero schema mutation on Participant, Attempt, and Session tables.
16. Zero Academic Core schema or data mutation.
17. Disposable DB cleanup executes in both PASS and FAIL paths.

## Exact Out-of-Scope
- migration / schema change
- editing BU-053 or BU-054 engineering
- SCHEDULED -> READY
- READY evaluation / preflight
- READY -> ACTIVE
- any other lifecycle transition
- automatic activation
- automatic time-based scheduler
- rescheduling runtime
- schedule conflict detection
- conflict override governance
- participant/proctor/room conflict logic
- Attempt Duration / latest-start policy
- Question Snapshot readiness / creation
- participant readiness
- scoring readiness
- anti-cheating readiness
- Proctor / Exam Room readiness
- Exam Entry
- Attempt creation
- Session creation
- API / routes / controllers
- frontend / UI
- Permission Matrix
- final RBAC / ABAC rules
- PB05 closure
- BU-056 selection / registration

## PB05 Status
OPEN / CARRIED FORWARD

## Controller Status
- Stage 1 Controller Unit Selection / Scope Freeze: PASS
- Stage 2 source execution: EXECUTED
- Controller engineering verification: PASS
- Package typecheck: PASS
- Focused tests: PASS / 13 TESTS
- Package regression: PASS / 145 TESTS
- Stage-2 implementation repository finalized: YES
- First Stage-3 Controller Physical Audit: FAIL — PROTECTED-SCHEMA VERIFIER PROOF GAP
- First Stage-3 finding classification: VERIFIER-OWNED PROOF GAP / NO RUNTIME DEFECT
- Targeted Stage-3 verifier remediation: EXECUTED
- Targeted Stage-3 remediation verification: PASS
- Targeted correction repository finalized: YES
- Correction commit: 96b315d382193ebd740d70eec369f0e50a6e9f52
- Stage-3 Controller Physical Re-Audit: PASS
- Fast-Track lifecycle close: COMPLETE
- First Stage-5 Final Physical Verification: FAIL — HANDOFF TERMINAL LIVE/CURRENT NAVIGATION STALE / CONTROL-STATE CONFLICT
- Finding classification: CONTROL-DOC / HANDOFF NAVIGATION DEFECT / NO ENGINEERING DEFECT
- Targeted Stage-5 Final-Physical Control Correction: EXECUTED
- Targeted Stage-5 Correction Repository Finalized: YES
- Targeted correction commit: f9042b9dd50b192ccd249fd59b630ced6e5ddeff
- Final Physical Re-Verification: PASS
- Final Physical Verification: PASS
- Done: YES
- Full BU-055 Repository Finalized: YES
- PB05: OPEN / CARRIED FORWARD
- Next Build Unit Selection / Scope Freeze: AUTHORIZED

## Final Engineering Hashes
- Runtime: `F207D0514A885A2FD7C64F58C5E0D37B2ED16D4DDCEE2995F88FF8AC0A7EE44F`
- Focused Test: `04B1D314181A178E591B6DD44DF4FC6F874CE5C2366FF77286A0D9D6C394489C`
- Verifier: `628118F46D1A412FF8579257BE6D2A0ADC99516B8270307976D008C04B76097E`
