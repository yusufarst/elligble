**Status:** COMPLETE / STAGE-2 IMPLEMENTATION EXECUTED / TARGETED VERIFIER-TARGET REMEDIATION COMPLETE / TARGETED REAL-DB EVIDENCE RECONSTRUCTION PASS / IMPLEMENTATION MATERIAL STATE PRESERVED / VERIFIED / TARGETED STAGE-2 REMEDIATION REPOSITORY FINALIZED NOT YET / CONTROLLER PHYSICAL AUDIT NOT YET / DONE NO / FULL BU-038 REPOSITORY FINALIZED NO / FINAL PHYSICAL VERIFICATION NOT YET
**Version:** 1.0.0
**Canonical:** YES
**Phase:** BUILD
**Domain Owner:** Academic Core

# BU-038 — Academic Core Grade Level Core State Persistence Bootstrap

## 1. Purpose
Establish authoritative tenant-scoped configurable Grade Level identity in Academic Core as an upstream academic-structure primitive for later Rombel and Enrollment context.

## 2. Canonical Basis
- `docs/01-discovery/03.01_ACADEMIC_CORE.md` (D03.1-05, D03.1-06)
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`

## 3. Predecessors
- BU-001 (Identity Tenant Foundation)
- BU-036 (Academic Core Academic Year and Period Core State Persistence Bootstrap)
- BU-037 (Academic Core Subject Core State Persistence Bootstrap)
Grade Level does NOT semantically depend on Subject or Academic Year.

## 4. Scope
- Grade Level Build Unit registration
- tenant-scoped Grade Level persistence
- minimum identity schema
- meaningful non-blank display label
- tenant isolation semantics
- versioned PostgreSQL migration
- migration-history integration
- migration repeat safety
- real PostgreSQL verification
- full migration chain 0001 through 0014
- BU-001 foundation regression
- BU-036 Academic Year/Period regression
- BU-037 Subject regression
- Fast-Track Build state/control synchronization
- controlled implementation commit/push

## 5. Out-of-Scope
- Academic Year modification
- Academic Period modification
- Subject modification
- Subject Offering
- Program/Major/Concentration
- Curriculum Context
- Rombel
- Enrollment
- Teaching Assignment
- Homeroom Responsibility
- Learning Classroom
- Learn
- general timetable
- general attendance
- Secure Assessment schema/runtime
- Teacher-managed contextual authorization
- Explicit Proctor changes
- API
- frontend/UI
- Capability Matrix update
- PB06 closure
- PB07 closure
- Grade progression engine

## 6. Persistence Contract
**Table:** `academic_core_grade_levels`

**Columns:**
- `id` (UUID PRIMARY KEY DEFAULT gen_random_uuid())
- `tenant_id` (UUID NOT NULL)
- `display_label` (VARCHAR(255) NOT NULL)
- `created_at` (TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP)

**Constraints:**
- `UNIQUE (id, tenant_id)`
- `chk_ac_grade_level_display_label_non_blank`: `btrim(display_label) <> ''`

## 7. Invariants
- GRADE LEVEL != ROMBEL.
- No hardcoded grade-value invariant (X, XI, XII not hardcoded).
- Tenant invariant: belongs to tenant, isolated per tenant.
- Non-blank label invariant: display label must contain meaningful non-whitespace text.
- Same labels across different tenants are allowed and do not create shared identity.

## 8. Verification Requirements
- Real PostgreSQL testing using disposable database.
- Fresh database test from migration 0001 through 0014.
- Repeat invocation of 0014 safely skips.
- Reject NULL display_label.
- Reject empty string display_label.
- Reject whitespace-only display_label.
- Reject structural absence (id, tenant_id, created_at).
- No FK to Academic Year, Academic Period, Subject, Program/Major, Rombel.
- No code, status, sequence, order columns.
- BU-001, BU-036, BU-037 remain healthy.

## 9. Authorized Paths
1. `docs/build/units/BU-038_ACADEMIC_CORE_GRADE_LEVEL_CORE_STATE_PERSISTENCE_BOOTSTRAP.md`
2. `database/migrations/0014_bu038_academic_core_grade_level_core_state.sql`
3. `database/verification/verify_bu038_academic_core_grade_level_core_state.sql`
4. `docs/build/BUILD_PHASE_INDEX.md`
5. `docs/state/CURRENT_STATE.md`
6. `docs/state/HANDOFF_PACKET.md`
7. `docs/DOCUMENT_MANIFEST.md`

## 10. Fast-Track Lifecycle State
- Stage 1 Unit Selection: COMPLETE
- Stage 2 Implementation: EXECUTED
- Original Stage-2 Process Defects: CONFIRMED
- Original Verifier Target Defect: CONFIRMED
- Original Real-DB Target Evidence: INSUFFICIENT
- First Reconciliation Attempt: STOPPED / PIPELINE PROCESS DEFECT CONFIRMED / NO COMMIT / NO PUSH
- Targeted Verifier-Target Remediation: COMPLETE
- Targeted Real-DB Evidence Reconstruction: PASS
- Implementation Material State: PRESERVED / VERIFIED
- Targeted Stage-2 Remediation Repository Finalized: YES only after push
- Controller Physical Audit: NOT YET
- Done: NO
- Full BU-038 Repository Finalized: NO
- Final Physical Verification: NOT YET

## 11. PB / SEC Preservation
- PB06: OPEN / NOT READY
- PB07: OPEN
- SEC-002: NOT PROMOTED.

## 12. Stop Conditions
- Prohibited file changes.
- Unclean git state before/after.
- Semicolon or command pipeline in powershell (e.g., `git add .; git commit`).
