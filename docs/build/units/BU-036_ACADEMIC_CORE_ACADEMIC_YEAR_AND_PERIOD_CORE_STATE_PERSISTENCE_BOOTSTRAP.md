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
- date-range ordering integrity (start_date <= end_date);
- date-range containment integrity (child Period within parent Year);
- tenant isolation;
- versioned PostgreSQL migrations (0009 base + 0010 remediation);
- real PostgreSQL verification;
- migration repeat safety;
- BU-001 predecessor regression;
- required Fast-Track control/state documentation.

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
- database/migrations/0010_bu036_academic_core_academic_year_period_core_state_remediation.sql
- database/verification/verify_bu036_academic_core_academic_year_period_core_state.sql
- docs/build/BUILD_PHASE_INDEX.md
- docs/state/CURRENT_STATE.md
- docs/state/HANDOFF_PACKET.md
- docs/DOCUMENT_MANIFEST.md

## PERSISTENCE CONTRACT (AFTER MIGRATION 0009 + 0010 REMEDIATION)
Table `academic_core_academic_years`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `display_label` VARCHAR(255) NOT NULL
- `start_date` DATE NOT NULL
- `end_date` DATE NOT NULL
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
- CHECK `chk_ac_year_dates` (start_date <= end_date)
- UNIQUE `uq_ac_academic_years_tenant` (id, tenant_id)

*(Note: unapproved status column introduced in migration 0009 was removed by remediation migration 0010)*

Table `academic_core_academic_periods`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `academic_year_id` UUID NOT NULL
- `display_label` VARCHAR(255) NOT NULL
- `period_type` VARCHAR(100) NULL
- `start_date` DATE NOT NULL
- `end_date` DATE NOT NULL
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
- CHECK `chk_ac_period_dates` (start_date <= end_date)
- CONSTRAINT `fk_ac_period_year` FOREIGN KEY (academic_year_id, tenant_id) REFERENCES academic_core_academic_years (id, tenant_id) ON DELETE RESTRICT
- TRIGGER `trg_ac_period_date_containment` (enforces Period start_date >= parent Year start_date AND Period end_date <= parent Year end_date)

## TENANT / FK INVARIANTS
- Academic Year requires a composite uniqueness constraint: `UNIQUE (id, tenant_id)`.
- Academic Period uses an intra-domain tenant-bound FK: `FOREIGN KEY (academic_year_id, tenant_id) REFERENCES academic_core_academic_years (id, tenant_id) ON DELETE RESTRICT`.
- Academic Period tenant == parent Academic Year tenant.
- Cross-tenant pairing is rejected at database level.

## DATE INTEGRITY INVARIANTS
- Academic Year start_date <= end_date.
- Academic Period start_date <= end_date.
- Academic Period date range must lie entirely within parent Academic Year date range.
- Updating parent Academic Year date range to exclude existing child Academic Periods is rejected.

## HISTORICAL / CONFIGURABILITY INVARIANTS
- Multiple configurable periods per Academic Year are supported (no hardcoded exactly-two-semester rule).
- Same period/year labels across different tenants do not create global collisions.
- Same period label across different Academic Years is supported.
- Historical multiple Academic Years may coexist for one tenant.
- Creating a later Academic Year does not overwrite an earlier Academic Year.
- Historical Academic Years and Periods can be read back by stable identity.

## VERIFICATION REQUIREMENTS
Real PostgreSQL verification must prove at minimum:
A. full migrations 0001–0010 apply successfully to a fresh database.
B. migration 0009 remains valid historical migration.
C. migration 0010 applies successfully.
D. repeat invocation of migration 0009 is safe.
E. repeat invocation of migration 0010 is safe.
F. migration history contains exactly one registration for 0009 and 0010.
G. exact BU-036 Academic Core table set remains: `academic_core_academic_years` and `academic_core_academic_periods`.
H. unapproved status column no longer exists.
I. Academic Year and Period tenant_id are required.
J. Academic Year start_date > end_date is rejected.
K. Academic Period start_date > end_date is rejected.
L. Academic Period before parent year start is rejected.
M. Academic Period after parent year end is rejected.
N. valid Academic Period fully inside parent year succeeds.
O. three or more valid Academic Periods may exist inside one Academic Year.
P. cross-tenant Year/Period linkage is rejected.
Q. nonexistent Academic Year reference is rejected.
R. historical Academic Years and Periods can be read back by stable identity.
S. BU-001 predecessor regression remains PASS.
T. disposable database cleanup succeeds.

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
PRIOR CONTROLLER PHYSICAL AUDIT FAIL /
TARGETED FORWARD REMEDIATION COMPLETE /
TARGETED REMEDIATION REPOSITORY FINALIZED /
AWAITING CONTROLLER PHYSICAL RE-AUDIT

DONE: NO
FULL BU-036 REPOSITORY FINALIZED: NO
FINAL PHYSICAL VERIFICATION: NOT YET
