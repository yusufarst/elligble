# BU-090 — Secure Assessment Authenticated Context HTTP API Integration Bootstrap

## 1. Context & Objective (Purpose)
Connect the verified `runtime/identity-access` (BU-088) and `runtime/tenant-access` (BU-089) foundations into the existing Secure Assessment HTTP server (`runtime/secure-assessment/src/server.ts`). This unit replaces request-supplied trusted identity/context assumptions with real Session Identity plus authoritative tenant Membership resolution. It materially shortens, but does not by itself close, the remaining authenticated browser -> trusted runtime context -> PostgreSQL Milestone-1 gap because browser credential persistence/transport integration remains out of scope.

## 2. Canonical Basis & Ownership
- **Canonical basis:** Repository is the highest source of truth; Product Completion Roadmap Milestone 1 gap.
- **Domain ownership:** 
  - Cross-Domain Integration / Secure Assessment (API Layer)
  - Identity (Session validation consumer)
  - Organization/Tenant (Membership validation consumer)
- **Direct predecessors:**
  - BU-080 (Secure Assessment HTTP API server foundation)
  - BU-088 (Identity Authentication Runtime)
  - BU-089 (Tenant Membership Context Runtime)
- **Protected regression surfaces:** BU-085 assigned-exam discovery, BU-086 proctor monitoring, BU-087 teacher readiness.

## 3. Scope & Constraints
- **In-scope:** 
  - Importing and composing `identity-access` and `tenant-access` into the Secure Assessment HTTP API server.
  - HTTP authenticated-context builder that obtains both `sessionId` and `sessionSecretAttempt` from a bounded server-side request credential parser.
  - Treating any requested tenant identifier as an UNTRUSTED locator only; `personId` must come exclusively from the resolved BU-088 Session Identity and Membership must come exclusively from BU-089.
  - Integrating the resulting bounded `{ tenantId, membershipId, personId }` context into the existing student assigned-exam discovery HTTP path as the first bounded consumer.
  - Existing Secure Assessment participant/proctor/teacher authorization remains separate and MUST NOT be inferred merely from tenant Membership.
  - Real integration tests proving denial of unauthenticated, expired, or cross-tenant requests.
- **Out-of-scope:** 
  - Database schema mutations or migrations (relies entirely on existing verified schema).
  - PB05 / Permission Matrix capability authorization.
  - Browser UI / frontend components, browser credential persistence, and browser-side session transport wiring.
  - Provisining credentials (read-only integration).
- **No-migration decision:** This BU relies solely on existing schema, requiring zero database mutations.

## 4. Authorized Paths
- `runtime/secure-assessment/package.json`
- `runtime/secure-assessment/package-lock.json`
- `runtime/secure-assessment/tsconfig.json`
- `runtime/secure-assessment/src/server.ts`
- `runtime/secure-assessment/src/http/**`
- `runtime/secure-assessment/test/http/**`
- `runtime/secure-assessment/verification/verify_bu090_authenticated_context_http_api_integration.js`
- `docs/build/units/BU-090_SECURE_ASSESSMENT_AUTHENTICATED_CONTEXT_HTTP_API_INTEGRATION_BOOTSTRAP.md`

## 5. Runtime Contract & Fail-Closed Cases
- **Runtime contract:** Must use the real BU-088/BU-089 contract `resolveAuthenticatedMembershipContext(sessionId, sessionSecretAttempt, requestedTenantId)`; no request-supplied Person identity is trusted.
- **Fail-closed cases:**
  - Missing session token.
  - Invalid/expired session token.
  - Valid session but no valid membership in the requested tenant context.
  - Any ambiguity in resolution.

## 6. Verification Requirements
- Real PostgreSQL verification proving HTTP request -> Identity Session -> Tenant Membership -> existing assigned-exam discovery context integration.
- HTTP-level rejection (401/403) of invalid credentials.
- Zero mutation of Identity/Tenant core states.

## 7. Exit Criteria
- Real BU-088 Session Identity is consumed; both `sessionId` and `sessionSecretAttempt` are required.
- Requested tenant input remains an untrusted locator.
- Person identity is derived only from the authenticated Session Identity.
- Membership is derived only through BU-089.
- Student assigned-exam discovery can consume the resulting authenticated tenant/person context without trusting fake Person/Tenant/Attempt identity headers.
- Invalid, expired, revoked, malformed, wrong-secret, no-membership, and cross-tenant requests fail closed.
- Membership context MUST NOT be treated as PB05 capability, Participant, Proctor, Teacher, or Exam Attempt authorization.
- Existing Secure Assessment route regressions remain PASS.
- No schema migration and no unauthorized Identity/Tenant mutation.
- Browser credential persistence/transport wiring remains explicitly deferred.

## 8. Control-State Constraints
- `PB04 CLOSED`
- `PB05 OPEN`
- `Milestone 1 NOT COMPLETE`

## 9. Status
- **Phase:** BUILD
- **Version:** 1.0.1
- **Supersedes:** 1.0.0
- **Status:** STAGE-1 PASS / FROZEN
- **Done:** NO
- **Full BU-090 Repository Finalized:** NO
- **Stage-1 Controller Physical Audit:** PENDING
- **Stage-2 Implementation:** NOT STARTED / NOT AUTHORIZED
- **Owner Decision Required:** NO
- **Stage-1 Process Truth:** registration execution used `manage_task` contrary to foreground-only control and produced two registration/state-sync commits instead of the requested single controlled commit; material selection remains preserved and this is classified as a non-material execution-control defect pending Controller re-audit.
