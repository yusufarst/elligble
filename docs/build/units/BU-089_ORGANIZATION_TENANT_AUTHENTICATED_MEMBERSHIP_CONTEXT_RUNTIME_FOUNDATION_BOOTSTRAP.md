# BU-089 — Organization/Tenant Authenticated Membership Context Runtime Foundation Bootstrap

## 1. Context & Objective (Purpose)
Establishes the read-only Organization/Tenant context resolution runtime (`runtime/tenant-access`) that consumes the BU-088 Session Identity to verify and resolve the authenticated `tenant_id` + `person_id` membership against `tenant_memberships`.

## 2. Canonical Basis & Ownership
- **Canonical basis:** Repository is the highest source of truth.
- **Domain ownership:**
  - Identity owns Session Identity
  - Organization/Tenant owns Membership
- **Direct predecessors:**
  - BU-001
  - BU-088

## 3. Scope & Constraints
- **In-scope:** Read-only runtime composition for membership context resolution.
- **Out-of-scope:** Database mutations, new migrations.
- **No-migration decision:** This BU relies solely on BU-001 and BU-088 schema, requiring zero schema changes.

## 4. Authorized Paths
- `runtime/tenant-access/package.json`
- `runtime/tenant-access/package-lock.json`
- `runtime/tenant-access/tsconfig.json`
- `runtime/tenant-access/src/index.ts`
- `runtime/tenant-access/test/runtime.test.ts`
- `database/verification/verify_bu089_organization_tenant_authenticated_membership_context.js`
- `docs/build/units/BU-089_ORGANIZATION_TENANT_AUTHENTICATED_MEMBERSHIP_CONTEXT_RUNTIME_FOUNDATION_BOOTSTRAP.md`

## 5. Runtime Contract & Fail-Closed Cases
- **Runtime contract:** Must call `identityRuntime.resolveSession(sessionId, secretAttempt)` and preserve strict domain boundaries.
- **Fail-closed cases:**
  - Ambiguity (duplicate memberships for the same person + tenant).
  - Cross-tenant requests (person not in requested tenant).
  - Cross-person requests.
  - Invalid, expired, or revoked sessions.
  - Returns `null` on failure.
  - Must not log session secrets or credentials.

## 6. Verification Matrix
- Exact membership non-mutation proof.
- Identity credential/session non-mutation proof (only legitimate bounded `last_activity_at` updates allowed).
- Real absolute expiry denial.
- Real idle expiry denial.
- Read-only membership state verification.

## 7. Stop Conditions
- `PB04 CLOSED`
- `PB05 OPEN`
- `Milestone 1 NOT COMPLETE`

## 8. Status
- **Phase:** BUILD
- **Version:** 1.0.1
- **Status:**
  ACTIVE /
  STAGE-2 IMPLEMENTATION COMPLETE /
  TARGETED STAGE-3 CORRECTION COMPLETE /
  ENGINEERING RE-VERIFICATION PASS /
  REAL POSTGRESQL RE-VERIFICATION PASS /
  CONTROLLER STAGE-3 RE-AUDIT PENDING
- **Implementation Commit:** `d36fa3f1afdd3622e502f353fd7aa9658d28b9e3` preserved
- **Targeted Correction:**
  Stage-3 Controller audit FAIL due to missing version bumps, missing artifact manifest rows, un-synchronized BU-088 terminal truth, incorrect PB04 wording, premature terminal verification claim, hardcoded plaintext test password, and lack of exact physical mutation proofs. All exact targeted-correction reasons have been forward-corrected in Version 1.0.1.
- **Stage-3 Correction Process Deviation:** manage_task/taskification used contrary to foreground-only control; five background processes visibly present; Owner confirmed zero remain; correction commit remained local-only during containment; origin/main remained d36fa3f1afdd3622e502f353fd7aa9658d28b9e3; no canonical remote mutation occurred from the taskification; classification NON-MATERIAL EXECUTION-CONTROL DEFECT AFTER OWNER CONTAINMENT; material verifier correctness still required re-verification before push.
