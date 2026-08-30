# BU-037: Academic Core Subject Core State Persistence Bootstrap

## 1. Purpose
Establish authoritative tenant-scoped stable Subject identity in Academic Core as an upstream prerequisite for later Subject Offering and Teaching Assignment context. This BU implements `SUBJECT` identity only.

## 2. Canonical Basis
- `docs/01-discovery/03.01_ACADEMIC_CORE.md`

## 3. Domain Owner
- Academic Core

## 4. Predecessor Distinction
- BU-001 is the foundation for Tenant identity.
- BU-036 is the chronological/current Academic Core persistence baseline and full-chain regression predecessor.
- **Note:** Subject does *not* semantically depend on Academic Year.

## 5. In-Scope
- Tenant-scoped stable Subject persistence.
- Minimum human-readable Subject identity (`display_label`).
- UUID identity.
- Created timestamp (`created_at`).
- Academic Core table ownership.
- Tenant isolation via composite unique constraint (`id`, `tenant_id`).
- Versioned PostgreSQL migration 0012 (`0012_bu037_academic_core_subject_core_state.sql`).
- Migration-history registration.
- Migration repeat safety.
- Real PostgreSQL verification.
- Full migration chain regression (BU-001 and BU-036).
- Fast-Track Build control/state synchronization.

## 6. Out-of-Scope
- Subject Offering.
- Subject lifecycle/status.
- Mandatory Subject code.
- National subject-code taxonomy.
- Curriculum Context.
- Curriculum mapping.
- Academic Year modification.
- Academic Period modification.
- Grade Level.
- Program/Major/Concentration.
- Rombel.
- Enrollment.
- Teaching Assignment.
- Homeroom Responsibility.
- Learning Classroom.
- Learn.
- General timetable.
- General attendance.
- Teacher-managed Exam ownership.
- Teacher-managed contextual supervision.
- Proctor runtime.
- Secure Assessment schema/runtime.
- API.
- Frontend/UI.
- Capability Matrix changes.
- SEC-002 promotion.
- PB06 closure.
- PB07 closure.

## 7. Persistence Contract
- Table: `academic_core_subjects`
- Stable Subject identity is the UUID, not the display string.
- Subject identity remains stable across Academic Years.
- Subject is structurally independent from Academic Year, Academic Period, Grade Level, Program, Curriculum, and Rombel.

## 8. Tenant Invariants
- `tenant_id` UUID NOT NULL.
- Same `display_label` across different tenants is ALLOWED.
- No global uniqueness on `display_label`.
- Composite uniqueness on `(id, tenant_id)`.

## 9. Verification Requirements
- Full migrations 0001–0012 apply successfully.
- Migration 0012 applies exactly once and is repeat-safe.
- `academic_core_subjects` exists and has no unintended breadth.
- Subject identity remains independent from Academic Year rows.
- Same Subject display label can exist in two different tenants.
- Multiple different Subject rows can coexist in one tenant.
- BU-001 and BU-036 regression checks PASS.

## 10. Authorized Paths
1. `docs/build/units/BU-037_ACADEMIC_CORE_SUBJECT_CORE_STATE_PERSISTENCE_BOOTSTRAP.md`
2. `database/migrations/0012_bu037_academic_core_subject_core_state.sql`
3. `database/verification/verify_bu037_academic_core_subject_core_state.sql`
4. `docs/build/BUILD_PHASE_INDEX.md`
5. `docs/state/CURRENT_STATE.md`
6. `docs/state/HANDOFF_PACKET.md`
7. `docs/DOCUMENT_MANIFEST.md`

## 11. Stop Conditions
- Material gate failure.
- Migration history count mismatch.
- Process discipline violation.

## 12. PB Relationship
- PB06: PRESERVED (OPEN)
- PB07: PRESERVED (OPEN)

## 13. Fast-Track Lifecycle Status
- STAGE 2: COMPLETE
- IMPLEMENTATION: EXECUTED
- TERMINAL / REAL POSTGRESQL VERIFICATION: PASS
- IMPLEMENTATION REPOSITORY FINALIZED: YES
- CONTROLLER PHYSICAL AUDIT: NOT YET
- DONE: NO
- FULL BU-037 REPOSITORY FINALIZED: NO
