# BU-040 — Academic Core Subject Offering Core State Persistence Bootstrap

## 1. Specification

### Purpose
Establish authoritative tenant-scoped, academic-period-bound Subject Offering context required for later Teaching Assignment and scoped academic authorization.

### Canonical Semantics
- Subject != Subject Offering.
- Subject is stable identity.
- Subject Offering is contextual/time-bound.
- Subject Offering is tenant-scoped.
- Subject Offering is Academic Year / Period bound.
- Subject Offering != Learning Classroom.
- Subject Offering != Teaching Assignment.
- One Subject Offering does NOT imply exactly one Rombel.
- Grade scope is OPTIONAL / where relevant.
- Program/Major is OPTIONAL and not implemented here.
- Curriculum Context may be referenced conceptually but is not implemented here.
- No unsupported business-context uniqueness.

### Physical Architecture
- Table: `academic_core_subject_offerings`
- Migration: `0016_bu040_academic_core_subject_offering_core_state.sql`
- Remediation Migration: `0017_bu040_subject_offering_migration_repeat_safety_remediation.sql`
- Verifier: `verify_bu040_academic_core_subject_offering_core_state.sql`

### Technical Design Constraints
1. `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
2. `tenant_id` UUID NOT NULL
3. `subject_id` UUID NOT NULL
4. `academic_period_id` UUID NOT NULL
5. `grade_level_id` UUID NULL
6. `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

**Invariants:**
- `UNIQUE (id, tenant_id)` on Subject Offering.
- Supporting key on `academic_core_academic_periods`: `UNIQUE (id, tenant_id)`.
- Subject composite FK: `(subject_id, tenant_id) REFERENCES academic_core_subjects(id, tenant_id) ON DELETE RESTRICT`.
- Period composite FK: `(academic_period_id, tenant_id) REFERENCES academic_core_academic_periods(id, tenant_id) ON DELETE RESTRICT`.
- Optional Grade composite FK: `(grade_level_id, tenant_id) REFERENCES academic_core_grade_levels(id, tenant_id) ON DELETE RESTRICT`.
- No direct `tenant_tenants` FK.

### Explicitly Excluded
- `academic_year_id` (Inherited through Period).
- `program_id`, `major_id`, `concentration_id`, `curriculum_id`.
- `academic_group_id`, `rombel_id`, `learning_classroom_id`, `teaching_assignment_id`.
- `display_label`, `code`, `status`, `effective_start`, `effective_end`.
- `capacity`, `sequence/order`, general timetable fields, attendance fields.
- Business UNIQUE constraint over subject/year/period/grade.

## 2. Current Implementation Status

- [x] STAGE 1: NEXT UNIT SELECTION / SCOPE FREEZE
- [x] STAGE 2: SINGLE MAIN BU EXECUTION
- [x] FIRST CONTROLLER PHYSICAL AUDIT: FAIL
- [x] TARGETED MIGRATION-SAFETY / VERIFIER / MANIFEST REMEDIATION: COMPLETE
- [x] REAL POSTGRESQL REVERIFICATION: PASS
- [x] CONTROLLER PHYSICAL RE-AUDIT: PASS
- [x] STAGE 4: LIFECYCLE CLOSE
- [x] DONE: YES
- [x] IMPLEMENTATION REPOSITORY FINALIZED: YES
- [x] FULL BU-040 REPOSITORY FINALIZED: YES
- [x] STAGE 5: FINAL PHYSICAL VERIFICATION
- [x] FINAL PHYSICAL VERIFICATION: PASS
