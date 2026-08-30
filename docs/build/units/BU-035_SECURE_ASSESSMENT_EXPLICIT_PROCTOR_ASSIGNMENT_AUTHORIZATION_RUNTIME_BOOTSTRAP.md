# BU-035 — Secure Assessment Explicit Proctor Assignment Authorization Runtime Bootstrap

## PURPOSE
Provide the minimum server-side authoritative runtime boundary that determines whether a given Person has current Proctor authority for a specific tenant-scoped Exam Instance based on active explicit Proctor Assignment state. This is the runtime prerequisite for SEC-002 (Teacher != Proctor Authorization Boundary).

## CANONICAL BASIS
- **SEC-002**: Teacher != Proctor Authorization Boundary.
- Teacher != Proctor. Teaching Assignment must not silently create Proctor authority.
- A Person may act as Proctor only when separately assigned/authorized for the relevant assessment context.

## PREDECESSORS
- **BU-034**: Created the explicit persisted Proctor Assignment schema (`secure_assessment_proctor_assignments`).

## SCOPE
- Implement one focused callable primitive in the Secure Assessment runtime to execute the authorization query.
- Use PostgreSQL via `pg.Pool`.
- Read-only execution; no mutation.

## AUTHORIZED PATHS
- `docs/build/units/BU-035_SECURE_ASSESSMENT_EXPLICIT_PROCTOR_ASSIGNMENT_AUTHORIZATION_RUNTIME_BOOTSTRAP.md`
- `runtime/secure-assessment/src/proctor-authorization.ts`
- `runtime/secure-assessment/test/proctor-authorization.test.ts`
- `runtime/secure-assessment/verification/verify_bu035_proctor_authorization.ts`
- `docs/build/BUILD_PHASE_INDEX.md`
- `docs/state/CURRENT_STATE.md`
- `docs/state/HANDOFF_PACKET.md`
- `docs/DOCUMENT_MANIFEST.md`

## RUNTIME AUTHORIZATION CONTRACT
Expose a single focused callable primitive (`authorizeExplicitProctorAssignment`) that queries the PostgreSQL persistence layer.

## INPUT CONTRACT
Shape `ProctorAuthorizationInput`:
- `tenantId: string`
- `examInstanceId: string`
- `personId: string`

## RESULT CONTRACT
A strongly typed discriminated union with three semantic outcomes:
- `authorized`
- `denied`
- `authorization_unavailable`

When `authorized`, it returns `AuthorizedProctorContext`:
- `tenantId`
- `examInstanceId`
- `personId`
- `proctorAssignmentId`

## AUTHORIZATION QUERY
- Read against `secure_assessment_proctor_assignments`.
- Must match `tenant_id`, `exam_instance_id`, `person_id`.
- Must require `revoked_at IS NULL`.
- Server-authoritative via `pg.Pool`.

## ALLOW / DENY / UNAVAILABLE SEMANTICS
**ALLOW:** Valid active explicit assignment for the exact tenant, Exam Instance, and Person.
**DENY:** Missing assignment, revoked assignment, wrong tenant, wrong Exam Instance, wrong Person, or missing/invalid identifiers.
**UNAVAILABLE:** Any database query failure (must fail closed).

## DOMAIN OWNERSHIP
Secure Assessment remains owner of Exam Instance and assessment-specific Proctor Assignment context. Identity remains owner of Person. This primitive receives `personId` as an already-resolved identity context input and does not implement authentication.

## NON-GOALS
- HTTP Proctor endpoint.
- Proctor dashboard / Proctor monitoring feed.
- Frontend/UI / Teacher UI / participant UI.
- Proctor assignment creation/revocation APIs.
- Teacher -> Proctor implicit promotion.
- Platform-wide RBAC / general Permission Matrix.
- PB05, PB06, PB07 closure.
- Schema alteration (NO migration 0009).

## VERIFICATION REQUIREMENTS
Must pass:
1. Unit tests (testing all logic paths).
2. TypeScript compiler (`npm run typecheck`).
3. Integration suite (`npm test`).
4. Real PostgreSQL verification script (`verify_bu035_proctor_authorization.ts`) verifying exact persistence linkage and fail-closed behaviors against real Migration 0008 tables.

## STOP CONDITIONS
- Implementation requires schema changes.
- Pre-existing unrelated test regressions are encountered.
- Fail-open or credential leaks occur.

## FAST-TRACK LIFECYCLE STATUS
COMPLETE /
PRIOR CONTROLLER PHYSICAL AUDIT FAIL /
TARGETED RUNTIME VALIDATION + VERIFICATION + HANDOFF CONTROL REMEDIATION COMPLETE /
CONTROLLER PHYSICAL RE-AUDIT FAIL /
SECOND TARGETED REAL-DB MISSING-ASSIGNMENT + HANDOFF NAVIGATION REMEDIATION COMPLETE /
SECOND CONTROLLER PHYSICAL RE-AUDIT PASS /
FAST-TRACK LIFECYCLE CLOSE COMPLETE /
FAST-TRACK REPOSITORY FINALIZED /
FINAL PHYSICAL VERIFICATION PASS

FINAL PHYSICAL VERIFICATION:
PASS
