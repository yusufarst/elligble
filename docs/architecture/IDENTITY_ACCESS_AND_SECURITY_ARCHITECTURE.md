# IDENTITY, ACCESS, AND SECURITY ARCHITECTURE

**Status:** LOCKED  
**Version:** 1.0.0  
**Artifact Type:** ARCHITECTURE  
**Canonical:** YES  
**Architecture Sequence:** SEQUENCE 3 - IDENTITY / ACCESS / SECURITY ARCHITECTURE  
**Unit ID:** NONE  
**Architecture Unit Naming Convention:** NOT YET ESTABLISHED  
**Build:** NOT AUTHORIZED

---

## 1. Purpose / Authority / Scope

This architecture defines Architecture-level Identity, Access, and Security requirements for ELLIGBLE. It addresses:
- Person / User Account / Membership separation;
- authentication boundaries and requirements;
- scoped authorization;
- capability / permission enforcement architecture;
- tenant / resource / context restrictions;
- privacy/security enforcement;
- exceptional-access boundaries;
- applicable cross-sequence handoffs.

This artifact translates existing LOCKED/FROZEN WHAT-level authority into HOW-level Architecture requirements. It does not supersede LOCKED/FROZEN sources. It does not select implementation technology, resolve Production Blockers by itself, or authorize Build.

## 2. Locked Identity and Context Model

The architecture explicitly preserves the following canonical distinctions:
- **Organization != Tenant**
- **Person != User Account != Membership**
- **Base Access != Operational Assignment**
- **Teacher != Teaching Assignment**
- **Teacher != Proctor**
- **Student != Exam Participant != Exam Attempt != Exam Session**
- **Guardian != Student**
- **Partner Organization != Partner Staff**
- **Account lifecycle != Membership lifecycle != Assignment lifecycle**
- **No global SUPER_ADMIN**

The architecture implements the following distinctions:
- **PERSON:** Human identity and continuity.
- **USER ACCOUNT:** Authentication-capable account representation.
- **MEMBERSHIP:** Person participation in an Organization/Tenant context.
- **OPERATIONAL ASSIGNMENT:** Contextual duties/authority beyond base membership.

Student identity/lifecycle continuity remains compatible with finalized Sequence 2 data ownership models.

## 3. Authentication Architecture Requirements

1. **Identity-to-Account Boundary:** Clear separation between authenticating the User Account and identifying the Person.
2. **Account Authentication State:** Authentication state is independent from Person/Membership lifecycle.
3. **Credential Lifecycle Requirements:** Enforcement hooks for credential rotation, expiry, and revocation.
4. **Account Recovery Capability Requirements:** Support for verifiable account recovery processes.
5. **MFA Capability / Policy Enforcement Hooks:** Architecture hook / policy dependency. Hooks to enforce MFA requirements.
6. **Authentication Failure / Lockout Policy Hooks:** Architecture hook / policy dependency. Hooks to trigger lockouts or throttle attempts based on policy.
7. **Session/Authentication-Context Requirements:** Abstract requirement for verifiable contextual session state linked to authentication events.
8. **Re-authentication Requirements:** Capability to force re-authentication for security-sensitive actions where policy requires.
9. **Break-Glass / Exceptional-Access Boundary:** Architecture boundary to facilitate emergency access mechanisms.
10. **Authentication Audit/Security-Event Hooks:** Hooks to emit events upon authentication success, failure, or anomaly.

Specific authentication providers, password rules, MFA factors, token formats, JWT, session mechanisms, and specific protocols remain explicit non-goals.

## 4. Authorization Decision Architecture

Authorization architecture is implementation-neutral. It establishes that authorization cannot be granted from a role-name alone.

Decisions must be capable of evaluating:
- authenticated account context;
- Person identity;
- active Membership;
- tenant / organization context;
- operational Assignment;
- capability / permission;
- resource scope;
- context scope;
- applicable policy;
- privacy / consent restrictions where applicable.

**Safety Rule:** Absence of required authorization context results in denial.

**Preserved Principle:** NO IMPLICIT CROSS-TENANT AUTHORIZATION. Tenant context must not silently expand because the same Person has another Membership.

## 5. Administrative Authority Boundaries

Conceptual Architecture boundaries are maintained between administrative and operational domains:

- **PLATFORM_OWNER:** Platform governance authority does NOT automatically imply unrestricted customer-data editing. Access to tenant/customer data requires valid governed authority/context.
- **PLATFORM_STAFF:** Internal/platform operations authority requires explicit valid assignment/scope. Platform Staff must not silently bypass tenant isolation.
- **TENANT / SCHOOL ADMINISTRATIVE AUTHORITY:** Tenant administrative authority remains tenant/resource/context scoped. Administrative designation does not create academic omnipotence or unrestricted sensitive-data access.
- **SUPPORT / OPERATIONAL ACCESS:** Must remain explicitly scoped. It must not silently become originating-domain ownership or universal access.
- **EXCEPTIONAL ACCESS:** Remains routed through the PROVISIONAL break-glass / exceptional-access boundary. It must not become permanent global authority.

**Preserved Principle:** NO GLOBAL SUPER_ADMIN.
There is no universal role that bypasses tenant/resource/privacy constraints.

## 6. Domain-Specific Authorization Constraints

- **TEACHER:** Teacher identity alone must not imply all teaching or assessment authority.
- **TEACHING ASSIGNMENT:** Teaching authority must remain assignment/context dependent.
- **PROCTOR:** Teacher != Proctor. Teacher-managed Assessment authorization may exist only in valid authorized context and must not make Teacher globally equal to Proctor.
- **GUARDIAN:** Guardian Base Access is distinct from Guardian Relationship context. Guardian != Student. Access is relationship-scoped to authorized student(s). Guardian access must not imply Student impersonation. Consent/authorization conditions remain applicable. Relationship verification mechanics remain deferred where not locked.
- **CARE:** Care access is highly restricted and minimum-necessary. Access is purpose/context scoped. Homeroom Teacher assignment does NOT automatically grant Care/Counselor authority. Counselor/Care authority remains distinct and sensitive. Safeguarding policy remains OPEN, and exact Care disclosure/escalation mechanics remain deferred.
- **PARTNER:** Partner Organization != Partner Staff. Partner Staff access remains purpose-limited, organization-scoped, authorization-aware, consent-aware, capability/context scoped, with no unrestricted global student search.
- **SECURE ASSESSMENT:** Sequence 3 defines applicable identity/access/security boundaries only. It does not design Sequence 4 timer, idempotency, attempt persistence, No Lost Answers, immutable exam mechanics, or mission-critical runtime internals.
- **RISK:** Risk Signal != verdict. Security or authorization architecture must not convert network/IP/location/risk context directly into a cheating decision.

## 7. Privacy / Security Enforcement Requirements

Architecture-level enforcement requirements for:
- **Student Data:** Private by default.
- **Access Scope:** Minimum necessary access.
- **Cross-Tenant:** Deny boundary.
- **Tenant-Isolation:** Dependency inherited from Sequence 2.
- **Care:** Highly restricted access boundary.
- **Partner:** Purpose limitation boundary.
- **Consent:** Consent-aware disclosure hooks.
- **Data-Classification:** Enforcement hooks.
- **Authentication/Security-Policy:** Enforcement hooks.
- **Authorization:** Default denial boundary.
- **Security-Sensitive Actions:** Explicit administrative boundaries.
- **Audit:** Requirement hooks for security events.
- **Secure Assessment:** Access-control boundaries for entry/participation.

These boundaries explicitly defer legal Controller/Processor allocation, DPIA completion, Care safeguarding policy, Partner verification/moderation policy, Data Classification governance, and incident-response operational readiness.

## 8. Denial / Revocation / Lifecycle Safety

Architecture principles for failure-safe authorization:
- missing required tenant context -> deny;
- missing required Membership -> deny where Membership is required;
- missing required Assignment -> deny where Assignment is required;
- missing capability/permission -> deny;
- resource outside authorized scope -> deny;
- cross-tenant access without explicit valid authority -> deny;
- restricted data without required policy/context -> deny;
- expired/revoked/invalid authentication context must not silently retain authority.

Sequence 2 lifecycle continuity is preserved. Architecture supports separation between Person continuity, User Account state, Membership lifecycle, Assignment lifecycle, and capability/permission validity. Termination/revocation of one layer must not silently delete historical Person identity or trusted history. Authorization reflects revocation/inactivation of context.

## 9. Break-Glass / Exceptional Access Boundary

Break-Glass Policy remains PROVISIONAL. Sequence 3 defines the Architecture boundary required to support future safe implementation.

Architecture requires:
- explicit exceptional context;
- minimum necessary scope;
- time-bounded or otherwise constrained authority where policy later requires;
- security-sensitive treatment;
- auditable use;
- no conversion into permanent global authority;
- later policy/implementation closure.

Final approval chains, duration, role names, and triggers are not established.

## 10. Audit / Security-Event Architecture Hooks

The architecture establishes hooks to emit verifiable security events and audit records for authentication anomalies, break-glass usage, capability elevation, and security-sensitive administrative actions. (Implementation deferred to Sequence 6).

## 11. Secure Assessment Access-Control Handoff

Sequence 3 establishes that only explicitly authorized human or system actors within a valid assessment context may exercise applicable Secure Assessment access/capabilities.

- **Student != Exam Participant:** Exam Participant is a domain context, not Base Access.
- **Teacher != Proctor:** Proctor is an operational assignment scoped to the assigned assessment context.
- An authorized Teacher may receive scoped monitoring/supervision capability for a specific teacher-managed Exam Instance where canonical policy permits.
- This does NOT make Teacher = Proctor globally.

Sequence 3 defines access/security boundaries only. Sequence 4 retains internal Secure Assessment critical architecture (timer, idempotency, attempt persistence, No Lost Answers, immutable exam mechanics).

## 12. Cross-Sequence Handoffs

- **SEQUENCE 2 -> SEQUENCE 3:** Inherits tenant isolation, data ownership, Person continuity, and privacy boundaries. Sequence 2 is not reopened.
- **SEQUENCE 3 -> SEQUENCE 4:** Provides authentication requirements, teacher/proctor separation, assessment authorization boundaries, participant constraints, and security-context requirements.
- **SEQUENCE 3 -> SEQUENCE 5:** Provides authorization/privacy boundaries that cross-domain contracts must honor.
- **SEQUENCE 3 -> SEQUENCE 6:** Provides runtime security/audit/incident enforcement requirements and hooks.
- **SEQUENCE 3 -> SEQUENCE 7:** Provides traceability obligations for Sequence 3 requirements and coverage items.

## 13. Production Blocker Preservation

All 12 Production Blockers remain **OPEN / CARRIED FORWARD**. **RESOLVED / CLOSED: 0**.

- **PB-01 Controller / Processor Legal Allocation:** Architecture hook only; legal allocation remains unresolved.
- **PB-02 Final Retention Periods / Retention Matrix:** OPEN.
- **PB-03 Required DPIA:** Privacy/data-flow/access boundary hook; DPIA remains unresolved.
- **PB-04 Full Authentication Policy:** Architecture provides enforcement hooks but does not approve final policy.
- **PB-05 Permission Matrix:** Architecture defines capability/scope boundaries but does not create or approve the final Permission Matrix.
- **PB-06 Assessment Capability Testing:** OPEN.
- **PB-07 Zero-Lost-Answer Verification:** OPEN.
- **PB-08 Care Safeguarding:** Restricted-access architecture only; policy remains OPEN and conditional where Care launches.
- **PB-09 Partner Verification / Moderation:** Purpose-limited access architecture only; missing policy/artifact remains unresolved and conditional where Partner launches.
- **PB-10 Data Classification + Consent Governance:** Enforcement hooks only; governance remains OPEN/MISSING.
- **PB-11 Backup + Restore Verification:** OPEN.
- **PB-12 Security / Incident-Response Readiness:** Security architecture hooks only; readiness remains later Production readiness work.

## 14. OPEN / PROVISIONAL / FUTURE / MISSING Safety

The three independent maturity axes (DECISION MATURITY, ARTIFACT STATUS, READINESS STATUS) are preserved:
- **Full Authentication Policy:** PROVISIONAL.
- **Break-Glass Policy:** PROVISIONAL.
- **Permission Matrix:** Decision NONE EXPLICIT / Artifact MISSING / Production Blocker.
- **Care Safeguarding:** OPEN / conditional.
- **Partner Verification / Moderation:** NONE EXPLICIT / MISSING / conditional Production Blocker.
- **Data Classification + Consent Governance:** OPEN / Artifact MISSING / Production Blocker.
- **Required DPIA:** NONE EXPLICIT / Production-blocking where required / Production Blocker.
- **Security / Incident-Response Readiness:** NONE EXPLICIT / Production Blocker.
- **Controller / Processor Legal Allocation:** OPEN / Production Blocker.
- **AI capabilities:** FUTURE / OPTIONAL / NON-BLOCKING.

## 15. Explicit Non-Goals / Technology Safeguard

This architecture explicitly DOES NOT select or define:
PostgreSQL / Postgres, database engine, physical schema, tables, columns, primary keys, foreign keys, tenant physical schema strategy, cross-domain FK strategy, ORM, RBAC, ABAC, Permission Matrix contents, token format, JWT, cookie/session implementation, session-store technology, OAuth/OIDC/SAML, specific authentication provider, specific MFA factor, password numeric policy, credential hashing algorithm, API endpoints, request/response payloads, event schemas, event bus, broker, sync-vs-async implementation, programming language, framework, frontend/backend stack, cloud/vendor, deployment topology, InsForge, migration scripts, or production application code.

## 16. Later Policy / Readiness Dependencies

This architecture preserves the fact that policy definitions, specific numeric targets, compliance matrices, operational incident readiness, and legal designations remain required before Production, but are not resolvable exclusively within this architecture boundary.

## 17. Lock Exit Checklist

- [x] preserves Organization != Tenant;
- [x] preserves Person != User Account != Membership;
- [x] preserves Base Access != Operational Assignment;
- [x] preserves Teacher != Teaching Assignment;
- [x] preserves Teacher != Proctor;
- [x] preserves no global SUPER_ADMIN;
- [x] preserves cross-tenant denial;
- [x] defines authentication Architecture requirements without choosing implementation;
- [x] defines membership/assignment/capability/scope-based authorization architecture;
- [x] does not create final Permission Matrix;
- [x] preserves student private-by-default;
- [x] preserves Care restricted access;
- [x] preserves Partner purpose limitation;
- [x] preserves minimum-necessary access;
- [x] defines break-glass only as a provisional architecture boundary;
- [x] preserves Secure Assessment access constraints without Sequence 4 leakage;
- [x] preserves all 12 Production Blockers as OPEN;
- [x] preserves maturity/artifact/readiness separation;
- [x] avoids Sequence 2 reopening;
- [x] avoids Sequence 4 internal design;
- [x] avoids Sequence 5 contract design;
- [x] avoids Sequence 6 runtime design;
- [x] avoids Sequence 7 exit-gate execution;
- [x] avoids technology selection;
- [x] avoids ERD/schema/API work;
- [x] leaves Build unauthorized.
