# BU-090 — Secure Assessment Authenticated Context HTTP API Integration Bootstrap

## 1. Context & Objective (Purpose)
Connect the verified `runtime/identity-access` (BU-088) and `runtime/tenant-access` (BU-089) foundations into the existing Secure Assessment HTTP server (`runtime/secure-assessment/src/server.ts`). This unit replaces the temporary injected trusted context seams (e.g., `X-Tenant-ID` or `Bearer <attempt-id>` fake headers) with real HTTP session extraction and authoritative tenant membership resolution, closing the "authenticated browser -> trusted runtime context -> PostgreSQL E2E" gap for Milestone 1.

## 2. Canonical Basis & Ownership
- **Canonical basis:** Repository is the highest source of truth; Product Completion Roadmap Milestone 1 gap.
- **Domain ownership:** 
  - Cross-Domain Integration / Secure Assessment (API Layer)
  - Identity (Session validation consumer)
  - Organization/Tenant (Membership validation consumer)
- **Direct predecessors:**
  - BU-088 (Identity Authentication Runtime)
  - BU-089 (Tenant Membership Context Runtime)

## 3. Scope & Constraints
- **In-scope:** 
  - Importing and composing `identity-access` and `tenant-access` into the Secure Assessment HTTP API server.
  - HTTP middleware or context builder to extract the real session identifier (e.g., from cookies or Authorization header).
  - Validating the session and resolving the authenticated tenant membership before passing context to the assessment runtime engines.
  - Real integration tests proving denial of unauthenticated, expired, or cross-tenant requests.
- **Out-of-scope:** 
  - Database schema mutations or migrations (relies entirely on existing verified schema).
  - PB05 / Permission Matrix capability authorization.
  - Browser UI / frontend components.
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
- **Runtime contract:** Must use `identityRuntime` and `tenantAccessRuntime` to resolve the `tenant_id` and `person_id`.
- **Fail-closed cases:**
  - Missing session token.
  - Invalid/expired session token.
  - Valid session but no valid membership in the requested tenant context.
  - Any ambiguity in resolution.

## 6. Verification Requirements
- E2E real PostgreSQL verification proving a full authenticated path from HTTP request -> Identity -> Tenant -> Secure Assessment core.
- HTTP-level rejection (401/403) of invalid credentials.
- Zero mutation of Identity/Tenant core states.

## 7. Stop Conditions
- `PB04 CLOSED`
- `PB05 OPEN`
- `Milestone 1 NOT COMPLETE`

## 8. Status
- **Phase:** BUILD
- **Version:** 1.0.0
- **Status:** STAGE-1 PASS / FROZEN
- **Done:** NO
- **Full BU-090 Repository Finalized:** NO
- **Stage-1 Controller Physical Audit:** PENDING
- **Stage-2 Implementation:** NOT STARTED / NOT AUTHORIZED
