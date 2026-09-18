# BU-088 — Identity Authentication and Session Identity Runtime Foundation Bootstrap

**Version:** 1.0.2
**Status:** ACTIVE / STAGE-2 IMPLEMENTATION COMPLETE / STAGE-3 PENDING
**Stage:** STAGE-1 PASS / FROZEN / CONTROLLER PHYSICAL AUDIT PASS
**STAGE-2:** IMPLEMENTATION COMPLETE / ENGINEERING VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / STAGE-3 CONTROLLER PHYSICAL AUDIT PENDING
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
