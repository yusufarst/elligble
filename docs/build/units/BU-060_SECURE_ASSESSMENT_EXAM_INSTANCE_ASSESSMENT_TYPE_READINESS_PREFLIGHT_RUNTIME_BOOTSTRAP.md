# BU-060: Secure Assessment Exam Instance Assessment-Type Readiness Preflight Runtime Bootstrap

## Purpose
Implement the smallest read-only runtime primitive that evaluates ONLY the Assessment Type portion of Secure Assessment Exam Instance readiness. This Build Unit MUST NOT decide overall READY eligibility.

## Canonical Basis
- `docs/00-governance/00.05_BUILD_EXECUTION_RULES.md`
- `docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md`
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/02-master-blueprint/02.04_CORE_JOURNEYS_AND_CRITICAL_FLOWS.md`
- `docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md`

## Predecessors
- BU-044
- BU-053
- BU-054
- BU-055
- BU-056
- BU-057
- BU-058
- BU-059

## Exact Implementation Scope
1. `runtime/secure-assessment/src/exam-instance-assessment-type-readiness-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-assessment-type-readiness-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu060_exam_instance_assessment_type_readiness_preflight.ts`
4. `docs/build/units/BU-060_SECURE_ASSESSMENT_EXAM_INSTANCE_ASSESSMENT_TYPE_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`

## Frozen Runtime Contract
**Input:** `tenantId`, `examInstanceId` (Must be valid UUIDs)
**Target Source:** `public.secure_assessment_exam_instances`
**Assessment Type Source:** `public.secure_assessment_assessment_types`
The evaluation is READ-ONLY. NO database mutation is allowed.

**Required Exam Instance conditions:**
1. Exam Instance resolves using exact `tenant_id` + `id`.
2. `lifecycle_state` must be exactly `SCHEDULED`.
3. `assessment_type_id` must be non-NULL.
4. `assessment_type_id` must resolve to the same tenant's `secure_assessment_assessment_types` row.

Use tenant-safe resolution. Do not infer cross-tenant Assessment Type authority.

## Result Union
Required result categories:
- `assessment_type_ready`
- `not_ready`
- `invalid_state`
- `denied`
- `unavailable`

For `assessment_type_ready` return at minimum: `examInstanceId`, `tenantId`, `assessmentTypeId`, `assessmentTypeDisplayLabel`.
For `not_ready` use exact blocker identity: `assessment_type_missing`.

Do NOT return overall exam readiness. Do NOT use a result named simply `ready`.
Wrong tenant / inaccessible Exam Instance must not leak cross-tenant data. Database/dependency failure must fail closed as `unavailable`.

## Authorization Boundary
- PB05 remains OPEN.
- Do not invent: permission names, role matrix, RBAC policy, ABAC policy.
- Use the same generic capability-evaluator pattern used by existing Secure Assessment runtime units: `granted`, `denied`, `unavailable`.
- This hook is not an approved Permission Matrix. Teacher != Proctor remains preserved.

## Focused Test Requirements
Implement focused tests proving at minimum:
1. SCHEDULED + tenant-safe valid Assessment Type + granted capability -> `assessment_type_ready`.
2. `assessment_type_ready` returns exact Exam Instance identity.
3. `assessment_type_ready` returns exact Assessment Type UUID.
4. `assessment_type_ready` returns Assessment Type display label.
5. SCHEDULED + `assessment_type_id` NULL -> `not_ready` / `assessment_type_missing`.
6. non-SCHEDULED lifecycle -> `invalid_state`.
7. denied capability -> `denied`.
8. unavailable/throwing capability -> `unavailable`.
9. wrong tenant / inaccessible Exam Instance -> `denied` and no data leakage.
10. database failure -> `unavailable`.
11. runtime performs no UPDATE / INSERT / DELETE.
12. no `lifecycle_state` mutation.
13. no Assessment Type mutation.

## Real PostgreSQL Verifier Requirements
Author the verifier but DO NOT execute it in this Agent run.
Verifier must be designed to prove on disposable real PostgreSQL:
1. canonical migrations through 0030 apply.
2. tenant A Assessment Type + SCHEDULED Exam Instance bound to that type -> `assessment_type_ready`.
3. returned Assessment Type identity and display label are exact.
4. SCHEDULED Exam Instance with NULL `assessment_type_id` -> `not_ready` / `assessment_type_missing`.
5. non-SCHEDULED Exam Instance -> `invalid_state`.
6. wrong tenant cannot observe or classify another tenant's Exam Instance as ready.
7. no Exam Instance row mutation.
8. no Assessment Type row mutation.
9. Academic Core schema/data remain unchanged.
10. Participant / Attempt / Session state remains unchanged.
11. migration 0030 contract remains preserved.
12. cleanup occurs on PASS and FAIL.

## Exact Out-of-Scope
DO NOT IMPLEMENT:
- SCHEDULED -> READY transition
- overall READY decision
- schedule/window readiness
- Question Snapshot readiness
- participant readiness
- duration/timing readiness
- scoring readiness
- anti-cheating readiness
- room readiness
- Proctor readiness
- technical/device compatibility readiness
- READY -> ACTIVE
- any lifecycle mutation
- `assessment_type_id` NOT NULL migration
- schema migration
- Assessment Type CRUD
- API/routes/controllers
- frontend/UI
- generated Exam title
- PB05 closure
- BU-061 selection

## Execution State
- **Stage 1 Controller Unit Selection / Scope Freeze:** PASS
- **Stage 2 Source Implementation:** EXECUTED / ORIGINAL REPOSITORY FINALIZATION HISTORICALLY COMPLETE
- **First Stage-3 Controller Physical Audit:** FAIL
- **Targeted Stage-3 Engineering Remediation:** EXECUTED
- **Targeted Stage-3 Engineering Re-Verification:** PASS
- **Targeted Remediation Repository Finalized:** YES
- **Stage-3 Controller Physical Re-Audit:** PASS
- **Fast-Track Lifecycle Close:** COMPLETE
- **DONE:** YES
- **FULL BU-060 REPOSITORY FINALIZED:** YES
- **FINAL PHYSICAL VERIFICATION:** PASS
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **PB05:** OPEN / CARRIED FORWARD
