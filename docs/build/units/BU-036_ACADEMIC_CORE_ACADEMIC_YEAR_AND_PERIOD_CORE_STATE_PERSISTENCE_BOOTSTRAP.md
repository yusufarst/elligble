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
- versioned PostgreSQL migrations (0009 base + 0010 remediation + 0011 concurrency hardening);
- concurrency-safe containment integrity under concurrent parent updates and child inserts/updates (Race A and Race B);
- real PostgreSQL verification (full-chain 0001–0011 SQL harness and JS concurrency harness);
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
- database/migrations/0011_bu036_academic_core_academic_year_period_concurrency_hardening.sql
- database/verification/verify_bu036_academic_core_academic_year_period_core_state.sql
- database/verification/verify_bu036_academic_core_academic_year_period_concurrency.js
- docs/build/BUILD_PHASE_INDEX.md
- docs/state/CURRENT_STATE.md
- docs/state/HANDOFF_PACKET.md
- docs/DOCUMENT_MANIFEST.md

## PERSISTENCE CONTRACT (AFTER MIGRATION 0009 + 0010 REMEDIATION + 0011 CONCURRENCY HARDENING)
Table `academic_core_academic_years`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `display_label` VARCHAR(255) NOT NULL
- `start_date` DATE NOT NULL
- `end_date` DATE NOT NULL
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
- CHECK `chk_ac_year_dates` (start_date <= end_date)
- UNIQUE `uq_ac_academic_years_tenant` (id, tenant_id)
- TRIGGER `trg_ac_year_date_containment` (enforces Academic Year date contraction does not exclude existing child Periods)

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
- TRIGGER `trg_ac_period_date_containment_concurrency` (enforces Period start_date >= parent Year start_date AND Period end_date <= parent Year end_date with parent `SELECT ... FOR SHARE` row-level locking)

## TENANT / FK INVARIANTS
- Academic Year requires a composite uniqueness constraint: `UNIQUE (id, tenant_id)`.
- Academic Period uses an intra-domain tenant-bound FK: `FOREIGN KEY (academic_year_id, tenant_id) REFERENCES academic_core_academic_years (id, tenant_id) ON DELETE RESTRICT`.
- Academic Period tenant == parent Academic Year tenant.
- Cross-tenant pairing is rejected at database level.

## DATE INTEGRITY & CONCURRENCY INVARIANTS
- Academic Year start_date <= end_date.
- Academic Period start_date <= end_date.
- Academic Period date range must lie entirely within parent Academic Year date range.
- Updating parent Academic Year date range to exclude existing child Academic Periods is rejected.
- Concurrency serialization: parent row locking (`SELECT ... FOR SHARE`) prevents parent date contraction from invalidating child period containment during concurrent transactions.

## HISTORICAL / CONFIGURABILITY INVARIANTS
- Multiple configurable periods per Academic Year are supported (no hardcoded exactly-two-semester rule).
- Same period/year labels across different tenants do not create global collisions.
- Same period label across different Academic Years is supported.
- Historical multiple Academic Years may coexist for one tenant.
- Creating a later Academic Year does not overwrite an earlier Academic Year.
- Historical Academic Years and Periods can be read back by stable identity.

## VERIFICATION REQUIREMENTS
Real PostgreSQL verification must prove at minimum:
A. full migrations 0001–0011 apply successfully to a fresh database.
B. migration 0009 remains valid historical migration.
C. migration 0010 applies successfully and is repeat-safe.
D. migration 0011 applies successfully, hardens concurrency, and is repeat-safe with true skip.
E. repeat invocation of migration 0009 is safe.
F. repeat invocation of migration 0010 is safe.
G. repeat invocation of migration 0011 is safe.
H. migration history contains exactly one registration for 0009, 0010, and 0011.
I. exact BU-036 Academic Core table set remains: `academic_core_academic_years` and `academic_core_academic_periods`.
J. unapproved status column no longer exists.
K. Academic Year and Period tenant_id are required.
L. Academic Year start_date > end_date is rejected.
M. Academic Period start_date > end_date is rejected.
N. Academic Period before parent year start is rejected.
O. Academic Period after parent year end is rejected.
P. valid Academic Period fully inside parent year succeeds.
Q. three or more valid Academic Periods may exist inside one Academic Year.
R. cross-tenant Year/Period linkage is rejected.
S. nonexistent Academic Year reference is rejected.
T. historical Academic Years and Periods can be read back by stable identity.
U. concurrency verifier proves Race A blocking before release and domain rejection after release (timeout/deadlock is FAIL).
V. concurrency verifier proves Race B blocking before release and domain rejection after release (timeout/deadlock is FAIL).
W. final out-of-range Period count is 0.
X. BU-001 predecessor regression remains PASS.
Y. disposable database cleanup succeeds.

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
FIRST TARGETED FORWARD REMEDIATION COMPLETE /
FIRST TARGETED REMEDIATION REPOSITORY FINALIZED /
FIRST CONTROLLER PHYSICAL RE-AUDIT FAIL /
SECOND TARGETED CONCURRENCY + VERIFICATION + MANIFEST REMEDIATION COMPLETE /
SECOND CONTROLLER PHYSICAL RE-AUDIT FAIL /
THIRD TARGETED VERIFICATION + CONTROL + PROCESS REMEDIATION COMPLETE /
THIRD TARGETED REMEDIATION REPOSITORY FINALIZED /
AWAITING THIRD CONTROLLER PHYSICAL RE-AUDIT

DONE: NO
FULL BU-036 REPOSITORY FINALIZED: NO
FINAL PHYSICAL VERIFICATION: NOT YET
