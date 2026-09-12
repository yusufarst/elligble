# BU-079: Secure Assessment Exam Instance Participant and Proctor Schedule Conflict Readiness Preflight Integration Bootstrap

Version: 1.0.0

## PURPOSE
BU-079 implements one bounded, read-only, tenant-safe runtime preflight that detects participant and explicit-Proctor schedule conflicts for one exact same-tenant SCHEDULED Exam Instance, and integrates it into the existing BU-068 baseline readiness composition preflight (`checkExamInstanceBaselineReadinessChecksCompositionPreflight`).

## CANONICAL BASIS
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md`
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/build/PRODUCT_COMPLETION_ROADMAP.md`
- `docs/build/units/BU-068_SECURE_ASSESSMENT_EXAM_INSTANCE_BASELINE_READINESS_CHECKS_COMPOSITION_PREFLIGHT_RUNTIME_BOOTSTRAP.md`
- `docs/build/units/BU-077_SECURE_ASSESSMENT_EXAM_INSTANCE_CONDITIONAL_ROOM_PROCTOR_READINESS_COMPOSITION_PREFLIGHT_RUNTIME_BOOTSTRAP.md`
- database/migrations/0008_bu034_secure_assessment_explicit_proctor_assignment_core_state.sql
- database/migrations/0025_bu053_secure_assessment_exam_instance_lifecycle_state.sql
- PB05: Permission Matrix (OPEN / CARRIED FORWARD)
- PB06: Production Blocker 06 (OPEN / NOT CLOSED)

## DIRECT PREDECESSORS
- BU-068 — Secure Assessment Exam Instance Baseline Readiness Checks Composition Preflight Runtime Bootstrap
- BU-077 — Secure Assessment Exam Instance Conditional Room and Proctor Readiness Composition Preflight Runtime Bootstrap

## SEQUENCE GATE
BU-077 terminal / DONE YES / repository finalized YES / Stage-5 final physical verification PASS.
BU-078 REJECTED / RETIRED / DO NOT EXECUTE.
BU-079 Fast-Track Stage-1 PASS / FROZEN by MAIN PROJECT CONTROL 010.

## FROZEN CONFLICT MODEL
- Target Exam Instance:
  - Exact same-tenant Exam Instance.
  - Lifecycle state MUST be `SCHEDULED` (fails closed as `invalid_state` otherwise).
  - Target MUST have a valid operational window (`window_starts_at IS NOT NULL AND window_ends_at IS NOT NULL AND window_ends_at > window_starts_at`, fails closed as `invalid_state` otherwise).
  - Wrong tenant or nonexistent: `denied`.
  - Database/query failure: `unavailable`.

## ELIGIBLE CONFLICTING EXAM STATES
Only other same-tenant Exam Instances in operational lifecycle states:
- `SCHEDULED`
- `READY`
- `ACTIVE`
- `PAUSED`

Ignored non-operational Exam Instance lifecycle states:
- `DRAFT`
- `ENDED`
- `FINALIZED`
- `ARCHIVED`

The target Exam Instance itself is strictly excluded from conflict matching.

## WINDOW OVERLAP SEMANTICS
Half-open interval semantics `[start, end)`:
- Overlap condition:
  `other.window_starts_at < target.window_ends_at AND other.window_ends_at > target.window_starts_at`
- Boundary touch is strictly NOT an overlap:
  `other.window_ends_at = target.window_starts_at` or `target.window_ends_at = other.window_starts_at`

## PARTICIPANT CONFLICT
Participant conflict exists when:
- Same tenant;
- Different Exam Instance;
- Overlapping operational windows;
- Conflicting operational lifecycle state;
- The same Person (`person_id`) is assigned as an Exam Participant to both exams.

Result semantics:
```typescript
{
  type: 'not_ready',
  blocker: 'participant_schedule_conflict',
  conflictingExamInstanceId: string,
  conflictingParticipantCount: number
}
```
- No individual person IDs exposed in the result.
- If multiple conflicting Exam Instances exist: deterministic first conflict selected by stable Exam Instance id ordering (`ORDER BY other_instance.id ASC LIMIT 1`).
- Distinct count of conflicting participant persons for the selected conflicting Exam Instance.

## PROCTOR CONFLICT
Proctor conflict exists when:
- Same tenant;
- Different Exam Instance;
- Overlapping operational windows;
- Conflicting operational lifecycle state;
- The same Person (`person_id`) has a non-revoked explicit Proctor assignment (`revoked_at IS NULL`) to both exams.

Revoked Proctor assignment (`revoked_at IS NOT NULL` on either target or other exam) does NOT conflict.

Result semantics:
```typescript
{
  type: 'not_ready',
  blocker: 'proctor_schedule_conflict',
  conflictingExamInstanceId: string,
  conflictingProctorCount: number
}
```
- No individual person IDs exposed in the result.
- Deterministic first conflicting Exam Instance selected by stable Exam Instance id ordering (`ORDER BY other_instance.id ASC LIMIT 1`).
- Distinct count of conflicting proctors for the selected conflicting Exam Instance.

## DETERMINISTIC BLOCKER PRIORITY
When both participant conflict and proctor conflict exist:
1. `participant_schedule_conflict` (WINS)
2. `proctor_schedule_conflict`

## CROSS-TENANT ISOLATION
Every query enforces exact `tenant_id` equality. Identical person IDs or coincidental identifiers across tenants never produce a conflict.

## SUCCESS RESULT
When no participant or proctor conflict exists:
```typescript
{
  type: 'schedule_conflict_ready',
  tenantId: string,
  examInstanceId: string
}
```

## CAPABILITY EVALUATOR CONTRACT
- Accepts generic capability evaluator `(ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision`.
- Evaluated EXACTLY ONCE for the exact `{ tenantId, examInstanceId }` context.
- Returns `denied` on denied, `unavailable` on unavailable or thrown error.

## BU-068 INTEGRATION
Integrated into `runtime/secure-assessment/src/exam-instance-baseline-readiness-checks-composition-preflight.ts`:
- Effective composition order:
  1. BU-065 composition (operational window, assessment type, question snapshot presence, participant presence, duration/window compatibility)
  2. BU-079 participant/proctor schedule-conflict preflight
  3. BU-067 question-content readiness
- BU-079 invoked using deterministic internal granted evaluator; top-level capability evaluator called exactly once.
- Earlier BU-065 blocker prevents execution of BU-079.
- Participant and proctor conflicts mapped to:
  `type: 'not_ready'`, `category: 'schedule_conflict'`, preserving blocker and conflict details.
- Conflict prevents BU-067 execution.
- If BU-079 passes -> proceeds to BU-067.
- Denied/unavailable/invalid_state fail closed.

## STRICT OUT OF SCOPE
- Overall READY evaluator
- `SCHEDULED -> READY` transition
- `READY -> ACTIVE` transition
- Physical room schedule conflict
- Physical room shared-resource persistence
- Room `display_label` conflict inference
- Schedule conflict override persistence or authorization
- Anti-cheating readiness / Security preset design
- Technical/device compatibility readiness
- Authentication provider / JWT / session tokens
- Permission Matrix (PB05)
- Production Blocker PB06 closure
- API routes / HTTP server modifications
- Frontend / UI / Frontend Entry Gate
- Academic Core mutation / Participant mutation / Proctor mutation
- Schema migration (migration 0035 strictly absent)
- BU-080 selection or registration

## PHYSICAL ROOM & OVERRIDE SAFETY
- Physical room conflict is NOT implemented. Cross-exam room labels are not inferred as shared physical identity. Physical-room conflict remains a documented readiness gap.
- Conflict override is NOT implemented. Detected conflicts remain strictly `not_ready`.

## VERIFICATION SUMMARY
- Package unit tests: 145/145 PASS
- BU-079 focused tests: 29/29 PASS (`test/exam-instance-participant-proctor-schedule-conflict-readiness-preflight.test.ts`)
- BU-068 integration regression tests: 31/31 PASS (`test/exam-instance-baseline-readiness-checks-composition-preflight.test.ts`)
- Package TypeScript strict check: PASS (`npm run typecheck`)
- Verifier standalone strict check: PASS
- Real PostgreSQL verifier: PASS (`verification/verify_bu079_exam_instance_participant_proctor_schedule_conflict_readiness_preflight.ts`)
  - Disposable database prefix: `elligble_bu079_`
  - Canonical migrations: 0001 through 0034 applied (history = 34)
  - Migration 0035: ABSENT
  - Pre-run zero-leak: PASS
  - Post-run zero-leak: PASS
  - Zero mutation of protected tables: PASS
  - Disposable DB cleanup: PASS / FAIL-CLOSED VERIFIED

## STATUS & METADATA
- **BUILD UNIT:** BU-079
- **TITLE:** Secure Assessment Exam Instance Participant and Proctor Schedule Conflict Readiness Preflight Integration Bootstrap
- **VERSION:** 1.0.0
- **STAGE-1:** PASS / FROZEN BY MAIN PROJECT CONTROL 010
- **STAGE-2 IMPLEMENTATION:** COMPLETE
- **STAGE-2 ENGINEERING VERIFICATION:** PASS
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **CURRENT STATUS:** IMPLEMENTATION REPOSITORY FINALIZED / AWAITING CONTROLLER PHYSICAL AUDIT
- **DONE:** NO
- **STAGE-3:** PENDING
- **LAST COMPLETED EXECUTABLE BUILD UNIT:** BU-077
- **ACTIVE BUILD UNIT:** BU-079
- **NEXT BUILD UNIT:** NOT YET REGISTERED
- **FRONTEND ENTRY GATE:** DEFERRED / NOT YET TRIGGERED
- **PB05:** OPEN / CARRIED FORWARD
- **PB06:** OPEN / NOT CLOSED
