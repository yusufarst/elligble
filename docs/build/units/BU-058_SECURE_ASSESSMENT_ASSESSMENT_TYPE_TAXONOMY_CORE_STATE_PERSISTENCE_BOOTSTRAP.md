# BU-058: Secure Assessment Assessment Type Taxonomy Core State Persistence Bootstrap

**BUILD UNIT:** BU-058
**TITLE:** Secure Assessment Assessment Type Taxonomy Core State Persistence Bootstrap
**PHASE:** BUILD
**STAGE 1 SCOPE FREEZE:** PASS

## Purpose
Persist stable tenant-scoped Assessment Type taxonomy identity inside Secure Assessment.
This is a bounded prerequisite for:
- later Exam Instance -> Assessment Type binding;
- later READY exam identity/type/context evaluation.

This Build Unit is taxonomy persistence only.

## Canonical Basis
- Preservation: Assessment Type != Exam Instance
- Canonical Terminology:
  - Assessment Type = taxonomy/category
  - Exam Instance = actual scheduled assessment
- Discovery D04.2-15 requires READY evaluation to include: exam identity/type/context.
- Discovery D04.2-26 requires Assessment Type.
- School-friendly examples include:
  - Ulangan Harian / Quiz
  - UTS / PTS
  - UAS / PAS
  - Try Out
  - Diagnostic
  - Practice
  - Other governed type
- Exact labels remain configurable/refinable. Recovery notes labels may vary by school, curriculum, or policy and may require localization.
- Assessment Type is NOT implemented as a fixed database enum.

## Stable Identity vs Configurable Label Distinction
- Stable identity is the `id UUID`.
- `display_label` is user-facing and configurable taxonomy wording.
- Changing a display label does not alter the Assessment Type identity.
- No fixed allowed-value CHECK constraint for labels.
- No PostgreSQL ENUM.
- No default seeded Assessment Type rows.
- No canonical-code enumeration.

## Frozen Persistence Contract
Create exactly one new Secure Assessment-owned table:
`public.secure_assessment_assessment_types`

### Required Columns
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID NOT NULL` (NO DEFAULT)
- `display_label VARCHAR(255) NOT NULL` (NO DEFAULT)
- `created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`

### Required Exact Composite Unique Constraint
`uq_sa_assessment_types_tenant`
`UNIQUE (id, tenant_id)`

### Required Exact Display-Label Integrity Constraint
`ck_sa_assessment_types_display_label_non_blank`
`CHECK (btrim(display_label) <> '')`

### Foreign Key Contract
- ZERO foreign keys on `public.secure_assessment_assessment_types` in this BU.
- `tenant_id` remains the tenant boundary/reference consistent with existing Secure Assessment persistence and the current cross-domain FK strategy.

## Predecessors
- BU-002: Secure Assessment Core State Persistence Bootstrap
- BU-053: Secure Assessment Exam Instance Lifecycle State Persistence Bootstrap
- BU-054: Secure Assessment Exam Instance Operational Window Persistence Bootstrap
- BU-056: Secure Assessment Exam Instance Attempt Duration Configuration Persistence Bootstrap
- BU-057: Secure Assessment Exam Instance Latest-Start Policy Persistence Bootstrap

## Verification Requirements
- PostgreSQL real validation on disposable database `elligble_bu058_<run-id>`.
- Single disposable database execution using transactions/rollback for scenario isolation.
- Canonical migrations 0001-0028 applied before BU-058.
- Migration 0029 applies cleanly; migration history reaches exactly 29 with exact ID: `0029_bu058_secure_assessment_assessment_type_taxonomy_core_state`.
- Exact table contract: columns, nullability, defaults, primary key.
- Composite unique constraint `uq_sa_assessment_types_tenant` verified.
- Check constraint `ck_sa_assessment_types_display_label_non_blank` verified:
  - Normal configurable labels accepted;
  - Empty string rejected;
  - Whitespace-only string rejected.
- Zero foreign keys verified.
- Zero seeded rows verified.
- Semantic repeat-safety verified (idempotent re-execution).
- Compatible pre-existing table recognized and history registered once.
- Incompatible pre-existing table rejected loudly without history registration.
- False history claim rejected loudly.
- Exam Instance immutability verified (no `assessment_type_id` or `assessment_type_code` added).
- BU-053, BU-054, BU-056, and BU-057 regressions verified.
- Academic Core protected schema and fixture data immutability verified.
- Disposable database cleanup verified (0 leaked databases).

## Exact Out-of-Scope
- Exam Instance `assessment_type_id` binding
- Exam Instance `assessment_type_code`
- mandatory Assessment Type enforcement on Exam Instance
- SCHEDULED -> READY
- READY evaluation / preflight runtime
- READY -> ACTIVE
- any lifecycle transition
- generated Exam display title
- optional internal Exam label/reference
- default Assessment Type seed data
- platform-global fixed Assessment Type enum
- localization/translation storage
- Assessment Type API
- Assessment Type UI
- Assessment Type CRUD runtime
- Assessment Type deletion/archive policy
- Exam Template implementation
- effective Attempt duration computation
- latest-start runtime enforcement
- Question Snapshot creation/runtime readiness
- participant readiness runtime
- scoring configuration/readiness
- anti-cheating configuration/readiness
- Exam Room readiness
- Proctor readiness
- technical compatibility readiness
- schedule-conflict detection
- final RBAC/ABAC/Permission Matrix
- PB05 closure
- BU-059 selection/registration

## Lifecycle Status
- **BUILD UNIT:** BU-058
- **STAGE 1 SCOPE FREEZE:** PASS
- **STAGE 2 IMPLEMENTATION:** REPOSITORY FINALIZED
- **IMPLEMENTATION COMMIT:** 7fb222a962f58ff86a5ce9e9ccb0dff084d79aee
- **FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL — DEFAULT-SEMANTIC COMPATIBILITY VALIDATION / VERIFIER PROOF GAP
- **FINDING CLASSIFICATION:** MATERIAL MIGRATION / VERIFICATION DEFECT
- **PROCESS DEFECT:** FORBIDDEN manage_task USED / PROCESS DEVIATIONS FALSELY REPORTED AS NONE
- **TARGETED STAGE-3 ENGINEERING REMEDIATION:** AUTHORED
- **TARGETED FOREGROUND REAL POSTGRESQL RE-VERIFICATION:** PASS
- **TARGETED STAGE-3 REMEDIATION:** EXECUTED
- **TARGETED REMEDIATION REPOSITORY FINALIZED:** YES
- **TARGETED REMEDIATION COMMIT:** e195e77092fb2b54b5f42449ab2e3ddc5c2b587b
- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** PASS
- **FAST-TRACK LIFECYCLE CLOSE:** COMPLETE
- **DONE:** YES
- **FULL BU-058 REPOSITORY FINALIZED:** YES
- **FINAL PHYSICAL VERIFICATION:** PASS
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **PB05:** OPEN / CARRIED FORWARD
- **BU-059:** NOT SELECTED / NOT REGISTERED
