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
- **Version:** 1.0.2
- **Supersedes:** 1.0.1
- **Status:**
  ACTIVE /
  STAGE-3 CONTROLLER PHYSICAL RE-AUDIT PENDING
- **Implementation Commit:** `d36fa3f1afdd3622e502f353fd7aa9658d28b9e3` preserved
- **Record:**
  - Stage-2 implementation commit: `d36fa3f1afdd3622e502f353fd7aa9658d28b9e3`
  - previous Stage-3 correction commit: `3c6451cc93b7bd2e000e964c56de9e7752038021`
  - Controller re-audit result of 3c6451: FAIL
  - Remaining exact findings: verifier PRE snapshots did not encompass all resolver operations; five runtime/tenant-access manifest rows absent; stale BU-088 live navigation remained; stale BU-088 manifest descriptor remained; Roadmap still said PB04 remains OPEN; manage_task/taskification was used; prohibited force-with-lease push was used.
  - Process truth: five background processes from earlier correction were Owner-contained to zero; later execution again invoked manage_task/taskification and then controlled-stopped; Owner again confirmed background processes = 0; prohibited --force-with-lease was used for commit 3c6451; 3c6451 still has parent d36fa3f1, so predecessor history remained intact; classification: NON-MATERIAL EXECUTION-CONTROL DEFECT AFTER OWNER CONTAINMENT.

### BU-089 Stage-3 Local Recovery Process Truth

- Prior BU-089 correction executions used `manage_task` / taskification contrary to foreground-only control.
- A prohibited `--force-with-lease` push was used while producing the earlier `3c6451cc93b7bd2e000e964c56de9e7752038021` state.
- Owner subsequently confirmed background processes returned to zero.
- Premature local BU-089 Stage-4/Stage-5 and BU-090 work was detected before canonicalization.
- That premature local chain is preserved on `recovery/bu089-premature-stage4-bu090-6ce0718` at `6ce0718163a759d1d093424db30fae7ddd50b485`.
- Local `main` was isolated back to the BU-089 Stage-3 correction candidate.
- BU-090 was NOT canonicalized.
- Canonical remote `origin/main` remained `3c6451cc93b7bd2e000e964c56de9e7752038021`.
- Classification: NON-MATERIAL EXECUTION-CONTROL DEVIATIONS / canonical remote preserved / BU-089 Stage-3 Controller physical re-audit remains required.
