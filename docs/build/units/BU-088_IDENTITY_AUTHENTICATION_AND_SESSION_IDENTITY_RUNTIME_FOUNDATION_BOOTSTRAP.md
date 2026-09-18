# BU-088 — Identity Authentication and Session Identity Runtime Foundation Bootstrap

**Version:** 1.0.3
**Status:** ACTIVE / ROUND-4 TARGETED SEMANTIC CORRECTION COMPLETE / CONTROLLER FINAL RE-AUDIT PENDING
**Stage:** STAGE-1 PASS / FROZEN / CONTROLLER PHYSICAL AUDIT PASS
**INITIAL STAGE-2 IMPLEMENTATION:** COMMIT 3291d7b80300eaa5debbac0c547c63f152dd3ce4 / PRESERVED
**BU-088 ROUND-1 ENGINEERING COMMAND VERIFICATION:** PASS
**BU-088 ROUND-1 CONTROLLER SEMANTIC RE-AUDIT:** FAIL
**ROUND-1 SEMANTIC DEFECT REASONS:** forgeable/replayable public session mint proof path; malformed non-empty session UUID path; insufficient exact PostgreSQL schema assertions; aggregate-only protected-state proof; hardcoded DB connection fallback; dependency lock absent; process-truth incomplete.
**BU-088 TARGETED STAGE-3 REMEDIATION ROUND-2 EXECUTION-CONTROL DEVIATION:** YES (During Round-2 Antigravity execution, schedule/manage_task/taskification were used again despite foreground-only control. task-185 was among the observed background/taskified executions.)
**ROUND-2 OWNER BACKGROUND CONTAINMENT:** PASS / ZERO BACKGROUND PROCESSES CONFIRMED
**ROUND-2 POST-STOP PHYSICAL AUDIT:** FAIL (NON-MATERIAL EXECUTION-CONTROL DEFECT: 12 staged files, 0 unstaged, 0 untracked, DOCUMENT_MANIFEST untouched, HEAD/origin preserved, remaining defects: trailing whitespace in verifier; character_maximum_length assertion absent; credential username index assertion absent; process truth incomplete.)
**BU-088 ROUND-2 FINAL CONTROLLER SEMANTIC AUDIT:** FAIL (Reasons: 1. TypeScript-only private session creation remained runtime-callable; 2. protected Academic/Secure Assessment snapshot covered only a hardcoded subset; 3. disposable database cleanup verifier remained fail-open; 4. exact schema/index checks were not fully public-schema/index-definition scoped; 5. implementation-file truth omitted package-lock; 6. public runtime credential-provisioning surface exceeded the bounded consumer runtime contract.)
**BU-088 TARGETED STAGE-3 REMEDIATION ROUND-3:** COMPLETE / ENGINEERING RE-VERIFICATION PASS / REAL POSTGRESQL RE-VERIFICATION PASS
**BU-088 ROUND-3 EXECUTION-CONTROL DEVIATION:** YES (manage_task was used during Round-3 despite foreground-only control and broad git add . was used).
**ROUND-3 OWNER CONTAINMENT:** PASS / ZERO BACKGROUND PROCESS REMAIN.
**ROUND-3 FINAL READ-ONLY PHYSICAL VERIFICATION:** PASS / exact 12 staged paths / zero unstaged / zero untracked / DOCUMENT_MANIFEST untouched / HEAD and origin preserved / Identity 20/20 / Real PostgreSQL PASS / Secure Assessment 153/153 / diff checks PASS.
**ROUND-3 CONTROLLER FINAL SEMANTIC AUDIT:** FAIL (Exact reasons: 1. protected constraint snapshot omitted CHECK constraints due key_column_usage inner join; 2. protected column schema snapshot did not cover enough metadata for full-schema equality; 3. BU-088 spec process truth lagged other control documents; 4. latest Round-3 execution-control deviation had not yet been recorded.)
**BU-088 ROUND-4 TARGETED SEMANTIC CORRECTION:** COMPLETE / ENGINEERING RE-VERIFICATION PASS / REAL POSTGRESQL RE-VERIFICATION PASS / CONTROLLER FINAL RE-AUDIT PENDING.
**PB04:** CLOSED
**PB05:** OPEN
**MILESTONE 1:** NOT COMPLETE
**STAGE-1 CONTROLLER PHYSICAL AUDIT:** PASS
**AUTHORIZATION BASELINE:** 870dc0a5599e8d34d2ddea308b04e4e3ca355405

## Purpose

Establish the minimum Identity-owned real authentication and server-authoritative Session Identity runtime foundation required before ELLIGBLE can replace injected/fake trusted-auth seams with actual authenticated account identity.

The unit must preserve:
Person != User Account != Membership

Identity owns:
Authentication / Session Identity

Organization/Tenant owns:
Tenant / Membership

Secure Assessment remains a consumer through explicit contracts.

This unit is a prerequisite foundation for later authenticated Secure Assessment integration.

It does NOT by itself claim:
REAL AUTHENTICATION GAP CLOSED = YES
or
MILESTONE 1 COMPLETE = YES.

## Stage-2 In-Scope

1. **IDENTITY-OWNED AUTHENTICATION PERSISTENCE**
   Minimal persistence required for real username/password authentication of existing User Accounts while preserving the existing Person / User Account boundary.
   Canonical login direction:
   ELLIGBLE ID / username + password
   Credential/authentication state must be Identity-owned.
   Do not move Authentication truth into Secure Assessment tables.

2. **ACCOUNT AUTHENTICATION STATE**
   Support the minimum state necessary to enforce the locked PB04 policy for ordinary authentication, including:
   - authentication failures;
   - applicable throttling/rate-limit state;
   - temporary account lockout state;
   - credential validity/revocation hooks.
   Do not redesign Person or Membership lifecycle.

3. **SERVER-AUTHORITATIVE SESSION IDENTITY**
   Persist and resolve a real authenticated Session Identity linked to:
   - User Account;
   - Person;
   - authentication event/time;
   - validity / expiry;
   - revocation/logout state.
   Ordinary-session lifetime/idle behavior must conform to the locked D02.5-59 / DEC-041 policy.
   Expired/revoked/invalid Session Identity: FAIL CLOSED.

4. **AUTHENTICATION RUNTIME**
   Identity-owned runtime primitives for:
   - authenticate username/password;
   - establish Session Identity;
   - resolve authenticated Session Identity;
   - enforce expiry/idle rules;
   - revoke/logout Session Identity;
   - record/update applicable failure/lockout state.

5. **EXPLICIT CONSUMER CONTRACT**
   Expose a bounded Identity-owned authenticated-session contract suitable for later consumption by Organization/Tenant and Secure Assessment.
   The contract may identify authenticated:
   - account identity;
   - Person identity;
   - session identity.
   It MUST NOT fabricate:
   - tenant Membership;
   - operational assignment;
   - capability;
   - exam Participant;
   - Exam Attempt authorization.

6. **SECURITY**
   No request-header-derived tenant/person trust.
   Do not treat:
   X-Tenant-ID or Bearer <attempt-id> as authentication.
   No plaintext password storage.
   No credential or session secret logging.
   No silent cross-tenant authorization.
   No external authentication vendor selection.
   If implementation would require a new external security/auth vendor or a material platform-wide technology decision: STOP / OWNER DECISION REQUIRED.

7. **VERIFICATION REQUIREMENTS FOR LATER STAGE-2**
   Freeze mandatory future verification:
   - strict TypeScript typecheck as applicable;
   - focused authentication/session unit tests;
   - real PostgreSQL verification;
   - migration-chain verification;
   - credential/session persistence verification;
   - correct-success login;
   - wrong-password denial;
   - failure/rate-limit behavior;
   - temporary lockout behavior according to locked policy;
   - expired session denial;
   - idle-expired session denial;
   - revoked/logout session denial;
   - malformed/unknown session denial;
   - no plaintext password persistence;
   - no sensitive-secret logging;
   - Person/User Account separation preserved;
   - existing BU-001 identity invariants preserved;
   - zero unauthorized mutation to Secure Assessment/Academic Core;
   - relevant existing regression suites remain PASS.

## Explicit Out-Of-Scope

BU-088 MUST NOT implement or define:
- PB05 Permission Matrix
- role/capability permission matrix
- tenant Membership selection/resolution
- assignment authorization
- Secure Assessment Participant authorization
- Exam Attempt authorization
- teacher/proctor authorization integration
- replacement of every Secure Assessment trusted-context seam
- browser login UI
- frontend routing
- MFA/TOTP implementation
- privileged authentication flow
- recovery-code implementation
- password-reset/account-recovery UI
- device trust
- passkeys
- SMS/email OTP
- step-up UI
- break-glass
- OAuth/OIDC/SAML provider selection
- external auth vendor
- JWT requirement
- biometric authentication
- PB05/PB06/PB07 closure
- production deployment

MFA policy remains preserved: privileged contexts require applicable MFA policy; mandatory MFA is not baseline for every student.
Do not silently expand scope.

## Predecessors / Authority

- BU-001 — Identity/Tenant Persistence Bootstrap
- BU-087 — last completed terminal Build Unit / successor gate predecessor
- Discovery 02 v1.0.1 D02.5-59
- DEC-041
- IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE v1.0.0
- 00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS v1.0.1
- PB04 CLOSED
(PB05 remains OPEN and is NOT a BU-088 closure target.)

## Future Implementation Path Classes

database/migrations/<next-available>_bu088_identity_authentication_session_identity*.sql
database/verification/verify_bu088_identity_authentication_session_identity*
runtime/identity-access/**

### BU-088 ROUND-2 POST-task91 EXECUTION-CONTROL CORRECTION

- **EXECUTION-CONTROL DEVIATION:** YES / final Round-2 audit-bundle generation command was auto-taskified as task-91 despite foreground-only control.
- **TASK-91 RESULT:** EXIT 0 / audit-bundle generation operation only; no commit or push was performed.
- **OWNER BACKGROUND CONTAINMENT AFTER task-91:** PASS / ZERO BACKGROUND PROCESSES CONFIRMED.
- **POST-task91 CONTAINMENT AUDIT:** PASS / HEAD 3291d7b80300eaa5debbac0c547c63f152dd3ce4 preserved / origin-main 4c6f3ef24cf0aa1def1f96e8d15b6f9bb6df163a preserved / divergence 1 0 / exact 12 staged paths / zero unstaged / zero untracked / DOCUMENT_MANIFEST untouched / cached and worktree diff checks PASS.
- **TASK-91 CLASSIFICATION:** NON-MATERIAL EXECUTION-CONTROL DEFECT / Owner-contained to zero / repository topology and staged remediation content preserved.
- **CONTROLLER STATUS:** BU-088 Round-2 final semantic and physical re-audit pending / commit and push not authorized.
