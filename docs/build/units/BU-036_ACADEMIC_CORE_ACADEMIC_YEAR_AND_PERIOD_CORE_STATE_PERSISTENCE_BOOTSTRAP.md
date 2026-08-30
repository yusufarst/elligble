# BU-036 — Academic Core Academic Year and Period Core State Persistence Bootstrap

## PURPOSE
Establish the minimum authoritative Academic Core persistence foundation for configurable and historical academic-time context required by later Academic Group/Rombel and Teaching Assignment authorization state.

## CANONICAL BASIS
- docs/01-discovery/03.01_ACADEMIC_CORE.md
- docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md
- docs/architecture/IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE.md

## DOMAIN OWNER
Academic Core

## PREDECESSOR
BU-001 — Minimum Foundation Identity/Tenant Persistence Bootstrap

## IN-SCOPE
- Academic Year persistence;
- Academic Period persistence;
- tenant scope;
- Academic Period -> Academic Year authoritative relationship;
- minimum configurable Academic Year/Period identity fields justified by canonical evidence;
- minimum historical/addressable semantics necessary to avoid overwriting prior context;
- tenant isolation;
- versioned PostgreSQL migration;
- real PostgreSQL verification;
- migration repeat safety;
- BU-001 predecessor regression;
- required Fast-Track Stage-2 control/state documentation.

## OUT-OF-SCOPE
- Subject;
- Subject Offering;
- Grade Level;
- Program / Major / Concentration;
- Academic Group / Rombel;
- Enrollment;
- Teaching Assignment;
- Homeroom Responsibility;
- Learning Classroom;
- Learn;
- general timetable;
- general attendance;
- Teacher-managed Exam ownership;
- Teacher-managed supervision authorization;
- Proctor runtime changes;
- Secure Assessment schema changes;
- Secure Assessment runtime changes;
- API;
- frontend/UI;
- Permission Matrix;
- Capability Matrix SEC-002 promotion;
- PB06 closure;
- PB07 closure;
- any other Production Blocker closure.

## AUTHORIZED PATHS
- docs/build/units/BU-036_ACADEMIC_CORE_ACADEMIC_YEAR_AND_PERIOD_CORE_STATE_PERSISTENCE_BOOTSTRAP.md
- database/migrations/0009_bu036_academic_core_academic_year_period_core_state.sql
- database/verification/verify_bu036_academic_core_academic_year_period_core_state.sql
- docs/build/BUILD_PHASE_INDEX.md
- docs/state/CURRENT_STATE.md
- docs/state/HANDOFF_PACKET.md
- docs/DOCUMENT_MANIFEST.md

## PERSISTENCE CONTRACT
Table `academic_core_academic_years`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `display_label` VARCHAR(255) NOT NULL
- `start_date` DATE NOT NULL
- `end_date` DATE NOT NULL
- `status` VARCHAR(50) NOT NULL DEFAULT 'PLANNED'
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

Table `academic_core_academic_periods`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `academic_year_id` UUID NOT NULL
- `display_label` VARCHAR(255) NOT NULL
- `period_type` VARCHAR(100) NULL
- `start_date` DATE NOT NULL
- `end_date` DATE NOT NULL
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

## TENANT / FK INVARIANTS
- Academic Year requires a composite uniqueness constraint: `UNIQUE (id, tenant_id)`.
- Academic Period uses an intra-domain tenant-bound FK: `FOREIGN KEY (academic_year_id, tenant_id) REFERENCES academic_core_academic_years (id, tenant_id) ON DELETE RESTRICT`.
- Cross-tenant pairing must be impossible.

## HISTORICAL / CONFIGURABILITY INVARIANTS
- Multiple periods per Academic Year are supported.
- Same period/year labels across different tenants do not create global collisions.
- Historical multiple Academic Years may coexist for one tenant.
- Creating a later Academic Year does not overwrite an earlier Academic Year.

## VERIFICATION REQUIREMENTS
Real PostgreSQL verification must prove at minimum:
A. migrations 0001–0009 execute successfully.
B. expected BU-036 tables exist.
C. no unintended BU-036 table breadth exists.
D. Academic Year is tenant scoped.
E. Academic Period requires an existing Academic Year.
F. Academic Period cannot reference an Academic Year from another tenant.
G. multiple Academic Periods may exist under one Academic Year.
H. the implementation does not hardcode exactly two periods.
I. the same period labels may be reused across different Academic Years where appropriate.
J. same labels across different tenants do not create global collisions.
K. multiple historical Academic Years may coexist for one tenant.
L. creating a later Academic Year does not overwrite an earlier Academic Year.
M. Academic Period historical rows remain addressable.
N. BU-001 foundation remains structurally/operationally valid.
O. migration repeat invocation creates no duplicate effect.
P. migration-history registration is correct.
Q. disposable database cleanup succeeds.

## STOP CONDITIONS
- Implementation requires runtime endpoint creation.
- Attempts to implement Secure Assessment logic.
- Unexpected table breadth.
- Fails real PostgreSQL verification.

## PRODUCTION BLOCKER RELATIONSHIP
- PB06: OPEN / NOT READY FOR CLOSURE
- PB07: OPEN

## FAST-TRACK LIFECYCLE STATUS
IMPLEMENTATION EXECUTED /
TERMINAL + REAL POSTGRESQL VERIFICATION PASS /
IMPLEMENTATION REPOSITORY FINALIZED /
AWAITING CONTROLLER PHYSICAL AUDIT
