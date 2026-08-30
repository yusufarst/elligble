# BU-039 — Academic Core Academic Group (Rombel) Core State Persistence Bootstrap

## 1. Specification

### Purpose
Establish authoritative tenant-scoped, academic-year-scoped Academic Group/Rombel persistence required by later Academic Enrollment and Teaching Assignment scope.

### Canonical Semantics
- Academic Group / Rombel is Academic Core truth.
- Rombel != Grade Level.
- Rombel != Learning Classroom.
- Rombel != Exam Room.
- Program/Major is optional and is NOT a prerequisite.
- Same Rombel display label across different Academic Years is valid and represents distinct historical records.
- Academic Period is NOT part of BU-039 minimum Rombel persistence.
- Lifecycle concept is canonical, but no physical status/lifecycle vocabulary is frozen in this BU.

### Physical Architecture
- Table: `academic_core_academic_groups`
- Migration: `0015_bu039_academic_core_academic_group_core_state`

### Required State Constraints
1. `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
2. `tenant_id` UUID NOT NULL
3. `academic_year_id` UUID NOT NULL
4. `grade_level_id` UUID NOT NULL
5. `display_label` VARCHAR(255) NOT NULL
6. `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

**Invariants:**
- Composite UNIQUE `(id, tenant_id)`
- Nonblank `display_label` CHECK using `btrim(display_label) <> ''`
- Tenant-scoped composite FK to `academic_core_academic_years (id, tenant_id)`
- Tenant-scoped composite FK to `academic_core_grade_levels (id, tenant_id)`

### Explicitly Excluded
- `tenant_tenants` direct FK
- `academic_period_id`
- `program_id`, `major_id`, `concentration_id`
- `curriculum_id`, `subject_id`
- `learning_classroom_id`, `exam_room_id`
- `homeroom_teacher_id`
- `status`, `code`, `capacity`, `sequence/order`
- `start_date`, `end_date`, progression fields
- `display_label` uniqueness (must allow same label across different years)

## 2. Current Implementation Status

- [x] STAGE 1: NEXT UNIT SELECTION / SCOPE FREEZE
- [x] STAGE 2: SINGLE MAIN BU EXECUTION
- [ ] STAGE 3: CONTROLLER PHYSICAL AUDIT
- [ ] STAGE 4: LIFECYCLE CLOSE
- [ ] STAGE 5: FINAL PHYSICAL VERIFICATION

## 3. Verifier
`verify_bu039_academic_core_academic_group_core_state.sql` execution PASS across fresh PostgreSQL instance.
