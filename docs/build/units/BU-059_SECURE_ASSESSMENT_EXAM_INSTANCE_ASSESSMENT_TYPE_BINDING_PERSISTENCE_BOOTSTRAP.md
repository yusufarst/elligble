# BU-059: Secure Assessment Exam Instance Assessment Type Binding Persistence Bootstrap

**BUILD UNIT:** BU-059
**TITLE:** Secure Assessment Exam Instance Assessment Type Binding Persistence Bootstrap
**PHASE:** BUILD
**STAGE 1 SCOPE FREEZE:** PASS

## Purpose
Bind `assessment_type_id` on `public.secure_assessment_exam_instances` to the tenant-scoped Assessment Type taxonomy established in BU-058.
This is a bounded prerequisite for:
- later READY exam identity/type/context evaluation.

## Canonical Basis
- Preservation: NULL is intentionally preserved in BU-059 for backward compatibility.
- Canonical Terminology:
  - Assessment Type = taxonomy/category
  - Exam Instance = actual scheduled assessment
- Constraint Strategy: Must use `ON DELETE RESTRICT` for the FK to maintain referential integrity.

## Frozen Persistence Contract
Target Table: `public.secure_assessment_exam_instances`

### Required Columns
- `assessment_type_id UUID NULL` (NO DEFAULT)

### Required Exact Foreign Key Constraint
`fk_sa_exam_instances_assessment_type`
`FOREIGN KEY (assessment_type_id, tenant_id) REFERENCES public.secure_assessment_assessment_types(id, tenant_id) ON DELETE RESTRICT`

### Required Exact Index
`idx_sa_exam_instances_assessment_type`
`ON public.secure_assessment_exam_instances (tenant_id, assessment_type_id)`

## Predecessors
- BU-002: Secure Assessment Core State Persistence Bootstrap
- BU-044: Secure Assessment Exam Instance Teaching Assignment Context
- BU-053: Secure Assessment Exam Instance Lifecycle State Persistence Bootstrap
- BU-054: Secure Assessment Exam Instance Operational Window Persistence Bootstrap
- BU-056: Secure Assessment Exam Instance Attempt Duration Configuration Persistence Bootstrap
- BU-057: Secure Assessment Exam Instance Latest-Start Policy Persistence Bootstrap
- BU-058: Secure Assessment Assessment Type Taxonomy Core State Persistence Bootstrap

## Verification Requirements
- PostgreSQL real validation on disposable database `elligble_bu059_<run-id>`.
- Single disposable database execution using transactions/rollback for scenario isolation.
- Canonical migrations 0001-0029 applied before BU-059.
- Migration 0030 applies cleanly; migration history reaches exactly 30 with exact ID: `0030_bu059_secure_assessment_exam_instance_assessment_type_binding`.
- Exact table contract additions: column `assessment_type_id`, nullability, FK, index.
- Negative tests for invalid id and cross-tenant id.
- Positive test for valid id.
- Backward compatibility verification (existing rows have NULL).
- Semantic repeat-safety verified (idempotent re-execution).
- Disposable database cleanup verified (0 leaked databases).

## Exact Out-of-Scope
- Exam Instance `assessment_type_code`
- mandatory Assessment Type enforcement on Exam Instance
- SCHEDULED -> READY
- READY evaluation / preflight runtime
- READY -> ACTIVE
- any lifecycle transition
- PB05 closure
- BU-060 selection/registration
