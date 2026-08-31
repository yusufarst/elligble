# BU-041 — School-Side TEACHER Staff Assignment Core State Persistence Bootstrap

## PURPOSE
Establish the minimum persistent school-side TEACHER staff responsibility/context bound to an existing tenant Membership. This is the prerequisite staff-responsibility layer required before a later Academic Core Teaching Assignment may be created.

## DOMAIN BOUNDARY
Identity / Tenant Access — operational staff responsibility context

## FROZEN PERSISTENCE DESIGN

### Table
`tenant_teacher_assignments`

### Columns
- `id` (UUID, PK, DEFAULT `gen_random_uuid()`)
- `tenant_id` (UUID, NOT NULL)
- `membership_id` (UUID, NOT NULL)
- `assigned_at` (TIMESTAMP WITH TIME ZONE, NOT NULL, DEFAULT `CURRENT_TIMESTAMP`)
- `revoked_at` (TIMESTAMP WITH TIME ZONE, NULL)

### Constraints & Invariants
- `UNIQUE (id, tenant_id)` on `tenant_teacher_assignments`
- Supporting key `UNIQUE (id, tenant_id)` on `tenant_memberships`
- Composite FK `(membership_id, tenant_id) REFERENCES tenant_memberships(id, tenant_id) ON DELETE RESTRICT`
- Temporal CHECK `(revoked_at IS NULL OR revoked_at >= assigned_at)`
- Active partial UNIQUE index `udx_tenant_teacher_assignments_active ON tenant_teacher_assignments (tenant_id, membership_id) WHERE revoked_at IS NULL`

### Explicitly Excluded
- Teaching Assignment, Enrollment, Academic Year/Period, Grade, Rombel
- Generic role table/framework, RBAC/ABAC framework
- `person_id`

## STATUS

- [x] STAGE 1: COMPLETE / CONTROLLER SCOPE FREEZE PASS
- [x] STAGE 2 IMPLEMENTATION: EXECUTED
- [x] REAL POSTGRESQL 18 VERIFICATION: PASS
- [x] HISTORICAL BU-001 CHECKPOINT VERIFICATION: PASS
- [x] BU-001 CURRENT-STATE COMPATIBILITY: PASS
- [x] BU-040 REGRESSION VERIFICATION: PASS
- [x] MIGRATION 0018 HISTORY COUNT: EXACTLY 1
- [x] IMPLEMENTATION GIT FINALIZATION: COMPLETE
- [x] IMPLEMENTATION REPOSITORY FINALIZED: YES
- [ ] CONTROLLER PHYSICAL AUDIT: NOT YET
- [ ] FAST-TRACK LIFECYCLE CLOSE: NOT YET
- [ ] DONE: NO
- [ ] FULL BU-041 REPOSITORY FINALIZED: NO
- [ ] FINAL PHYSICAL VERIFICATION: NOT YET