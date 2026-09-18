# BU-089 — Organization/Tenant Authenticated Membership Context Runtime Foundation Bootstrap

## 1. Context & Objective
Establishes the read-only Organization/Tenant context resolution runtime (`runtime/tenant-access`) that consumes the BU-088 Session Identity to verify and resolve the authenticated `tenant_id` + `person_id` membership against `tenant_memberships`.

## 2. Boundary & Constraints
- **Role:** Read-only runtime composition.
- **Dependencies:** `runtime/identity-access` for session resolution.
- **Rules:**
  - Must call `identityRuntime.resolveSession(sessionId, secretAttempt)`.
  - Fails closed on ambiguity (returns null if `tenant_memberships` returns 0 or >1 rows for a given person + requested tenant).
  - Preserves domain boundary: Identity owns Person; Tenant owns Membership.
  - Cannot mutate database. No migrations allowed.
  - Must not log session secrets or credentials.

## 3. Scope
- `runtime/tenant-access/package.json`
- `runtime/tenant-access/tsconfig.json`
- `runtime/tenant-access/src/index.ts`
- `runtime/tenant-access/test/runtime.test.ts`
- `database/verification/verify_bu089_organization_tenant_authenticated_membership_context.js`

## 4. Status
- **Phase:** BUILD
- **Version:** 1.0.0
- **Status:** IMPLEMENTATION COMPLETE
- **Terminal Verification:** PASS
- **Repository Finalized:** YES
