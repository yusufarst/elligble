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
- Non-blank Subject identity constraint (`btrim(display_label) <> ''`).
- UUID identity.
- Created timestamp (`created_at`).
- Academic Core table ownership.
- Tenant isolation via composite unique constraint (`id`, `tenant_id`).
- Versioned PostgreSQL migration 0012 (`0012_bu037_academic_core_subject_core_state.sql`).
- Versioned PostgreSQL migration 0013 (`0013_bu037_academic_core_subject_display_label_integrity_remediation.sql`).
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

## 8. Tenant & Identity Invariants
- `tenant_id` UUID NOT NULL.
- `display_label` VARCHAR(255) NOT NULL.
- Non-blank invariant: `display_label` must contain at least one non-whitespace character (`btrim(display_label) <> ''` via `chk_ac_subject_display_label_non_blank`).
- Same `display_label` across different tenants is ALLOWED.
- No global uniqueness on `display_label`.
- Composite uniqueness on `(id, tenant_id)`.

## 9. Verification Requirements
- Full migrations 0001–0013 apply successfully.
- Migrations 0012 and 0013 apply exactly once and are repeat-safe.
- `academic_core_subjects` exists and has no unintended breadth.
- Subject identity remains independent from Academic Year rows.
- Same Subject display label can exist in two different tenants.
- Multiple different Subject rows can coexist in one tenant.
- NULL, empty, and whitespace-only `display_label` are rejected.
- BU-001 and BU-036 regression checks PASS.

## 10. Authorized Paths
1. `database/migrations/0013_bu037_academic_core_subject_display_label_integrity_remediation.sql`
2. `database/verification/verify_bu037_academic_core_subject_core_state.sql`
3. `docs/build/units/BU-037_ACADEMIC_CORE_SUBJECT_CORE_STATE_PERSISTENCE_BOOTSTRAP.md`
4. `docs/build/BUILD_PHASE_INDEX.md`
5. `docs/state/CURRENT_STATE.md`
6. `docs/state/HANDOFF_PACKET.md`
7. `docs/DOCUMENT_MANIFEST.md`

## 11. Historical Process Defect Record
- Stage-2 initial execution recorded process defects: `manage_task` usage, PowerShell pipeline usage, `git add .`, command chaining, environment enumeration, and commit subject drift.
- Targeted forward remediation remediates schema/verifier/navigation defects with strict foreground single-command discipline.

## 12. PB Relationship
- PB06: PRESERVED (OPEN)
- PB07: PRESERVED (OPEN)

## 13. Fast-Track Lifecycle Status
- STAGE 2 IMPLEMENTATION: EXECUTED
- TERMINAL / REAL POSTGRESQL VERIFICATION: PRIOR PASS
- PRIOR CONTROLLER PHYSICAL AUDIT: FAIL
- TARGETED FORWARD INTEGRITY + VERIFICATION + CONTROL REMEDIATION: COMPLETE
- TARGETED REMEDIATION REPOSITORY FINALIZED: YES
- CONTROLLER PHYSICAL RE-AUDIT: NOT YET
- DONE: NO
- FULL BU-037 REPOSITORY FINALIZED: NO
- FINAL PHYSICAL VERIFICATION: NOT YET
