# BU-042 — Academic Core Teaching Assignment Core State Persistence Bootstrap
**Version:** 1.0.0


## PURPOSE
Establish the minimum persistent canonical Teaching Assignment relation connecting an existing school-side TEACHER staff assignment to an existing Subject Offering and Academic Group/Rombel, while preserving tenant isolation, co-teaching, assignment history, and teacher replacement history.

Canonical distinction:
Teacher / TEACHER assignment != Teaching Assignment.
Teaching Assignment represents: which teacher teaches which subject/offering to which academic group within the defined academic context.

## DOMAIN OWNER
Academic Core

## FROZEN PERSISTENCE DESIGN

### Table
`academic_core_teaching_assignments`

### Columns
- `id` (UUID, PK, DEFAULT `gen_random_uuid()`)
- `tenant_id` (UUID, NOT NULL)
- `teacher_assignment_id` (UUID, NOT NULL)
- `subject_offering_id` (UUID, NOT NULL)
- `academic_group_id` (UUID, NOT NULL)
- `assigned_at` (TIMESTAMP WITH TIME ZONE, NOT NULL, DEFAULT `CURRENT_TIMESTAMP`)
- `revoked_at` (TIMESTAMP WITH TIME ZONE, NULL)

### Constraints & Invariants
- `UNIQUE (id, tenant_id)` on `academic_core_teaching_assignments`
- Composite FK `(teacher_assignment_id, tenant_id) REFERENCES tenant_teacher_assignments(id, tenant_id) ON DELETE RESTRICT`
- Composite FK `(subject_offering_id, tenant_id) REFERENCES academic_core_subject_offerings(id, tenant_id) ON DELETE RESTRICT`
- Composite FK `(academic_group_id, tenant_id) REFERENCES academic_core_academic_groups(id, tenant_id) ON DELETE RESTRICT`
- Temporal CHECK `(revoked_at IS NULL OR revoked_at >= assigned_at)`
- Active partial UNIQUE index `udx_academic_core_teaching_assignments_active ON academic_core_teaching_assignments(tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) WHERE revoked_at IS NULL`

### Required Semantics
- Co-teaching: different teachers may simultaneously reference the same subject offering and group.
- Teacher replacement/history: old assignment revoked, new assignment created. Historical rows remain preserved.

### Explicitly Excluded
- `subject_id`, `academic_period_id`, `academic_year_id`, `grade_level_id`, `membership_id`, `person_id`, `learning_classroom_id`
- Academic Enrollment, Student placement
- Learning Classroom, Homeroom Responsibility
- Generic assignment table, generic role table, RBAC, ABAC

## STATUS

- [x] STAGE 1: COMPLETE / CONTROLLER SCOPE FREEZE PASS
- [x] STAGE 2: EXECUTED
- [x] TERMINAL VERIFICATION: PASS
- [x] REAL POSTGRESQL 18 VERIFICATION: PASS — AUTHORIZED FOREGROUND EXECUTION
- [x] HISTORICAL BU-001 CHECKPOINT VERIFICATION: PASS
- [x] BU-001 CURRENT-STATE COMPATIBILITY: PASS
- [x] BU-041 REGRESSION VERIFICATION: PASS
- [x] BU-040 REGRESSION VERIFICATION: PASS
- [x] MIGRATION 0019 REPEAT-SAFETY: PASS
- [x] MIGRATION 0019 HISTORY COUNT: EXACTLY 1
- [x] PROCESS-CONTROL RECOVERY: COMPLETE — unauthorized manage_task/background verification evidence discarded; targeted foreground remediation + fresh PostgreSQL verification PASS
- [x] IMPLEMENTATION GIT FINALIZATION: COMPLETE
- [x] IMPLEMENTATION REPOSITORY FINALIZED: YES
- [x] CONTROLLER PHYSICAL AUDIT: PASS
- [x] FAST-TRACK LIFECYCLE CLOSE: COMPLETE
- [x] DONE: YES
- [x] FULL BU-042 REPOSITORY FINALIZED: YES
- [x] FINAL PHYSICAL VERIFICATION: PASS
