# BU-046: Academic Core Student Enrollment Core State Persistence Bootstrap

## Purpose
Bootstrap the core persistence model for Student Academic Enrollment, establishing the minimum authoritative, tenant-scoped, historical persistence linking a Tenant Membership to an Academic Group/Rombel and an Academic Period.

## Scope
- Establish `academic_core_student_enrollments` table.
- Enforce strict tenant boundaries via composite unique keys and foreign keys.
- Enforce Group/Period Academic-Year coherence.
- Implement explicit, opaque status and source/provenance fields without enumerating taxonomies.
- Support historical start/end lifecycle semantics.
- Add materially necessary non-unique retrieval indexes for Academic Enrollment.

## Out of Scope
- Final Student Academic Status vocabulary / taxonomy / enum.
- Promotion / transfer / graduation workflow semantics.
- STUDENT RBAC/Base Access or generic role framework.
- Any modifications to Secure Assessment or person models.

## Architectural Truths
1. **Enrollment != Person, Enrollment != Membership:** Enrollment is an academic core construct linking a membership to a specific academic placement.
2. **Tenant Isolation:** Cross-tenant pairings of membership, group, and period are strictly prohibited.
3. **Temporal Lifecycle:** Enrollments have a required start date and an optional end date (where end >= start).
4. **Explicit Status & Source:** Status and source are required textual fields. No enumerations are defined at this stage.

## Implementation Details

### `academic_core_student_enrollments`
- `id` UUID PRIMARY KEY
- `tenant_id` UUID NOT NULL
- `academic_year_id` UUID NOT NULL
- `membership_id` UUID NOT NULL
- `academic_group_id` UUID NOT NULL
- `academic_period_id` UUID NOT NULL
- `start_date` DATE NOT NULL
- `end_date` DATE NULL
- `status` VARCHAR(255) NOT NULL
- `source` VARCHAR(255) NOT NULL
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL

### Foreign Keys
- `tenant_memberships (id, tenant_id)`
- `academic_core_academic_groups (id, tenant_id, academic_year_id)`
- `academic_core_academic_periods (id, tenant_id, academic_year_id)`

### Indexes
- `idx_ac_student_enrollments_tenant_period_group` ON `(tenant_id, academic_period_id, academic_group_id)`
- `idx_ac_student_enrollments_tenant_membership_period` ON `(tenant_id, membership_id, academic_period_id)`

### Supporting Modifications
- Add `uq_tenant_memberships_id_tenant` to `tenant_memberships`.
- Add `uq_ac_groups_id_tenant_year` to `academic_core_academic_groups`.
- Add `uq_ac_periods_id_tenant_year` to `academic_core_academic_periods`.

## Build Lifecycle Status

- **STAGE 1 — NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** PASS
- **STAGE 2 — SINGLE MAIN BU EXECUTION:** EXECUTED
- **FIRST CONTROLLER PHYSICAL AUDIT:** FAIL
- **TARGETED RETRIEVAL-INDEX / VERIFIER / MANIFEST REMEDIATION:** COMPLETE
- **REAL POSTGRESQL RE-VERIFICATION:** PASS
- **BU-001 ISOLATED PREDECESSOR REGRESSION:** PASS
- **BU-036 ISOLATED PREDECESSOR REGRESSION:** PASS
- **BU-039 ISOLATED PREDECESSOR REGRESSION:** PASS
- **MIGRATION 0021 REPEAT SAFETY:** PASS
- **MIGRATION 0022 REPEAT SAFETY:** PASS
- **MIGRATION 0021 HISTORY COUNT:** EXACTLY 1
- **MIGRATION 0022 HISTORY COUNT:** EXACTLY 1
- **BU-046 FINAL VERIFIER:** PASS
- **DISPOSABLE DATABASE CLEANUP:** PASS
- **FIRST CONTROLLER PHYSICAL RE-AUDIT:** FAIL — CONTROL / MANIFEST SYNC INCOMPLETE
- **TARGETED CONTROL / MANIFEST SYNC:** COMPLETE
- **SECOND CONTROLLER PHYSICAL RE-AUDIT:** FAIL — BUILD_PHASE_INDEX FAST-TRACK CONTROL BLOCK ACCIDENTALLY REMOVED
- **TARGETED BUILD INDEX CONTROL RESTORATION:** COMPLETE
- **THIRD CONTROLLER PHYSICAL RE-AUDIT:** FAIL — DOCUMENT_MANIFEST DYNAMIC IDENTITY SYNC INCOMPLETE
- **TARGETED MANIFEST DYNAMIC IDENTITY REMEDIATION:** COMPLETE
- **FOURTH CONTROLLER PHYSICAL RE-AUDIT:** PASS
- **CONTROLLER PHYSICAL RE-AUDIT:** PASS
- **AWAITING NEXT CONTROLLER PHYSICAL RE-AUDIT:** NO
- **FAST-TRACK LIFECYCLE CLOSE:** COMPLETE
- **DONE:** YES
- **FULL BU-046 REPOSITORY FINALIZED:** YES
- **FINAL PHYSICAL VERIFICATION:** NOT YET
