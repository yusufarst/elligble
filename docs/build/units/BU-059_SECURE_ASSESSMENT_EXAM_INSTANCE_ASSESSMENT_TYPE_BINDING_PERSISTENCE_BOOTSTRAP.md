# BU-059: Secure Assessment Exam Instance Assessment Type Binding Persistence Bootstrap

**BUILD UNIT:** BU-059
**TITLE:** Secure Assessment Exam Instance Assessment Type Binding Persistence Bootstrap
**PHASE:** BUILD
**STAGE 1 SCOPE FREEZE:** PASS

## Lifecycle Truth
- **STAGE 1 SCOPE FREEZE:** PASS
- **STAGE 2 SOURCE EXECUTION:** EXECUTED
- **FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL
- **FIRST TARGETED STAGE-3 REMEDIATION:** EXECUTED
- **FIRST TARGETED REMEDIATION COMMIT:** 729325264550b53e5b599dc18ef9647e58d4ef3d
- **FIRST STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** FAIL
- **SECOND TARGETED STAGE-3 VERIFIER REMEDIATION:** EXECUTED
- **SECOND TARGETED REMEDIATION COMMIT:** c5deb53f56990bd9b4724bded23cebd5b7c0329d
- **SECOND STAGE-3 ENGINEERING PHYSICAL RE-AUDIT:** PASS
- **SECOND STAGE-3 PROCESS-CONTROL RE-AUDIT:** FAIL
- **PROCESS FINDING CLASSIFICATION:** PROCESS CONTROL / PROCESS-TRUTH DEFECT ONLY | NO ENGINEERING DEFECT ESTABLISHED
- **SECOND-REMEDIATION PROCESS DEVIATIONS:**
  - environment auto-backgrounded/taskified one multiline node -e invocation as task-3375 after WaitMsBeforeAsync threshold;
  - Owner cancelled the background-running task;
  - manage_task was NOT used;
  - git checkout was used on the BU-059 verifier despite explicit prohibition;
  - checkout affected only Agent-authored intermediate work after a clean entry baseline;
  - full engineering verifier was subsequently rerun foreground and passed;
  - final report omitted checkout and contained an internally inconsistent BACKGROUND/TASKIFIED EXECUTION: NO statement.
- **THIRD TARGETED STAGE-3 PROCESS-TRUTH REMEDIATION:** EXECUTED
- **THIRD TARGETED REMEDIATION REPOSITORY FINALIZED:** YES
- **THIRD STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** FAIL
- **MANIFEST FINDING CLASSIFICATION:** CONTROL / DOCUMENT_MANIFEST FINAL-BYTE IDENTITY DEFECT ONLY | NO NEW ENGINEERING DEFECT ESTABLISHED | NO NEW PROCESS DEFECT ESTABLISHED
- **FOURTH TARGETED STAGE-3 MANIFEST / CONTROL-TRUTH REMEDIATION:** EXECUTED
- **FOURTH TARGETED REMEDIATION COMMIT:** 33a4c379a5dc368b26e7236c19fce18e8534d0ee
- **FOURTH TARGETED REMEDIATION REPOSITORY FINALIZED:** YES
- **FOURTH STAGE-3 ENGINEERING / PROCESS / MANIFEST MATERIAL AUDIT:** PASS
- **FOURTH STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** FAIL
- **FOURTH RE-AUDIT FINDING CLASSIFICATION:** CONTROL / LIVE NAVIGATION STATE-SYNC DEFECT ONLY | NO ENGINEERING DEFECT ESTABLISHED | NO NEW PROCESS DEFECT ESTABLISHED | NO NEW MANIFEST HASH DEFECT ESTABLISHED
- **FIFTH TARGETED STAGE-3 LIVE-NAVIGATION / CONTROL-TRUTH REMEDIATION:** EXECUTED
- **FIFTH TARGETED REMEDIATION REPOSITORY FINALIZED:** YES
- **AWAITING FIFTH CONTROLLER PHYSICAL RE-AUDIT:** YES
- **DONE:** NO
- **FULL BU-059 REPOSITORY FINALIZED:** NO
- **FINAL PHYSICAL VERIFICATION:** NOT YET
- **PB05:** OPEN / CARRIED FORWARD

## Purpose
Bind `assessment_type_id` on `public.secure_assessment_exam_instances` to the tenant-scoped Assessment Type taxonomy established in BU-058.
This is a bounded prerequisite for later READY exam identity/type/context evaluation.

## Canonical Basis
- Preservation: NULL is intentionally preserved in BU-059 for backward compatibility.
- Canonical Terminology:
  - Assessment Type = taxonomy/category
  - Exam Instance = actual scheduled assessment
- Constraint Strategy: Must use `ON DELETE RESTRICT` for the composite FK to maintain referential integrity.
- Index Strategy: Fast lookup by `(tenant_id, assessment_type_id)` on exam instances using exact frozen index `idx_sa_exam_instances_tenant_assessment_type` (NON-UNIQUE).

## Frozen Persistence Contract
Target Table: `public.secure_assessment_exam_instances`

### Required Columns
- `assessment_type_id UUID NULL` (NO DEFAULT)

### Required Exact Foreign Key Constraint
- Constraint Name: `fk_sa_exam_instances_assessment_type`
- Definition: `FOREIGN KEY (assessment_type_id, tenant_id) REFERENCES public.secure_assessment_assessment_types(id, tenant_id) ON DELETE RESTRICT`

### Required Exact Index
- Index Name: `idx_sa_exam_instances_tenant_assessment_type`
- Definition: `CREATE INDEX idx_sa_exam_instances_tenant_assessment_type ON public.secure_assessment_exam_instances (tenant_id, assessment_type_id);`
- Property: NON-UNIQUE

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
- Exact table contract additions: column `assessment_type_id` (UUID NULL NO DEFAULT), composite FK `fk_sa_exam_instances_assessment_type` (ON DELETE RESTRICT), non-unique index `idx_sa_exam_instances_tenant_assessment_type`.
- Negative tests for invalid id, cross-tenant id, and delete restriction.
- Negative migration-compatibility tests for wrong column type, not null, default, wrong FK, wrong index target/columns/order, and unique index.
- False history negative scenarios: missing schema and incompatible schema.
- Safe convergence on compatible pre-existing state without history.
- Positive test for same-tenant valid binding and multiple exam instances referencing the same type.
- Backward compatibility verification (pre-existing exam instances remain NULL).
- Semantic repeat-safety verified (idempotent re-execution).
- BU-058 contract preservation (columns, unique constraint, check constraint, zero FKs, zero seed rows, assessment_type_code absent).
- Predecessor and Academic Core immutability verification.
- Disposable database cleanup verified (0 leaked databases).

## Exact Out-of-Scope
- Exam Instance `assessment_type_code`
- Mandatory Assessment Type enforcement on Exam Instance (`assessment_type_id NOT NULL`)
- Assessment Type CRUD / API / UI
- Seed or default Assessment Types
- SCHEDULED -> READY transition
- READY evaluation / preflight runtime implementation
- READY -> ACTIVE transition
- Any lifecycle transition
- PB05 closure (PB05 remains OPEN / CARRIED FORWARD)
- BU-060 selection or registration
