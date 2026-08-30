# BU-034 — Secure Assessment Explicit Proctor Assignment Core State Persistence Bootstrap

## PURPOSE
Implement the smallest persistence foundation needed for explicit Secure Assessment Proctor Assignment.
This BU addresses the persistence prerequisite for: SEC-002 — Teacher != Proctor Authorization Boundary.
It does NOT complete SEC-002 runtime authorization.

## CANONICAL BASIS
- Teacher != Proctor.
- Teaching Assignment must never silently create Proctor authority.
- Proctor is an explicit operational assignment scoped to an assessment context.

## PREDECESSORS
- BU-033

## SCOPE
- Create `secure_assessment_proctor_assignments` table in migration 0008.

## AUTHORIZED PATHS
- docs/build/units/BU-034_SECURE_ASSESSMENT_EXPLICIT_PROCTOR_ASSIGNMENT_CORE_STATE_PERSISTENCE_BOOTSTRAP.md
- database/migrations/0008_bu034_secure_assessment_explicit_proctor_assignment_core_state.sql
- database/verification/verify_bu034_secure_assessment_explicit_proctor_assignment_core_state.sql
- docs/build/BUILD_PHASE_INDEX.md
- docs/state/CURRENT_STATE.md
- docs/state/HANDOFF_PACKET.md
- docs/DOCUMENT_MANIFEST.md

## PERSISTENCE CONTRACT
Table `secure_assessment_proctor_assignments`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `exam_instance_id` UUID NOT NULL
- `person_id` UUID NOT NULL
- `assigned_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
- `revoked_at` TIMESTAMP WITH TIME ZONE NULL

## INVARIANTS
- Intra-domain tenant-bound FK: FOREIGN KEY (exam_instance_id, tenant_id) REFERENCES secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT
- Temporal check: revoked_at IS NULL OR revoked_at >= assigned_at
- Active-assignment uniqueness: unique active assignment for (tenant_id, exam_instance_id, person_id) where revoked_at IS NULL.
- Behavior:
  - one Person may be assigned to multiple Exam Instances;
  - one Exam Instance may have multiple different Proctors;
  - same Person cannot have duplicate simultaneous active assignment for the same Exam Instance;
  - revoked assignment remains historical;
  - after revocation, same Person may be assigned again to the same Exam Instance;
  - multiple historical revoked rows are allowed.
- Cross-domain boundary: No direct DB FK from person_id to identity_persons. No direct DB FK for tenant_id to tenant_tenants.

## NON-GOALS
- Proctor authorization runtime
- Proctor authentication/session capability
- Teacher authorization runtime
- Teacher-to-Proctor automatic promotion
- Proctor dashboard
- monitoring UI
- Teacher UI
- API endpoints
- participant runtime changes
- risk-signal processing
- anti-cheating verdict logic
- Permission Matrix
- PB05 closure
- PB06 closure
- PB07 closure
- capability matrix promotion
- frontend components
- Graphify refresh
- new vendor/platform selection

## VERIFICATION REQUIREMENTS
- Real PostgreSQL verification script testing constraints, tenant isolation, cross-tenant rejection, uniqueness, nulls, multiple assignments, revocation, temporal checks, safety, FK delete restriction, etc.

## STOP CONDITIONS
- entry HEAD/origin mismatch
- working tree not clean at entry
- canonical conflict appears
- scope requires authorization runtime
- scope requires changing LOCKED/FROZEN authority
- new Owner Decision trigger appears
- real PostgreSQL verification fails
- unexpected tracked path changes
- commit/push verification fails

## FAST-TRACK LIFECYCLE STATUS
COMPLETE /
PRIOR CONTROLLER PHYSICAL AUDIT FAIL /
FIRST TARGETED VERIFICATION + MANIFEST REMEDIATION COMPLETE /
FIRST CONTROLLER PHYSICAL RE-AUDIT FAIL /
SECOND TARGETED MANIFEST + HANDOFF CONTROL REPAIR COMPLETE /
SECOND CONTROLLER PHYSICAL RE-AUDIT FAIL /
THIRD TARGETED HANDOFF NAVIGATION + CONTROL SYNC REPAIR COMPLETE /
THIRD CONTROLLER PHYSICAL RE-AUDIT PASS /
FAST-TRACK LIFECYCLE CLOSE COMPLETE /
FAST-TRACK REPOSITORY FINALIZED
