**Status:** ACTIVE - CONTROL BASELINE  
**Version:** 0.1.1  
**Phase:** ARCHITECTURE  
**Artifact Type:** PHASE CONTROL / INDEX  
**Authority:** DYNAMIC CONTROL / PHASE INDEX - DOES NOT SUPERSEDE LOCKED/FROZEN SOURCES  
**Canonical Architecture Specification:** NO  
**Architecture Unit Naming Convention:** NOT YET ESTABLISHED  
**Substantive Architecture Design:** NOT STARTED  
**Build:** NOT AUTHORIZED  
**Last Reviewed:** 2026-08-17

# Architecture Phase Index

## 1. Purpose

This file controls Architecture phase progression.

It does NOT itself define:
- ERD
- database schema
- table/column design
- foreign-key strategy
- API endpoints
- request/response payloads
- event schemas
- implementation technology
- framework choice
- deployment topology
- application code

The LOCKED Master Blueprint remains WHAT-level authority.

Architecture will determine HOW only through later controlled units.

## 2. Entry State

- **Recovery:** COMPLETE / FROZEN
- **Discovery:** COMPLETE / LOCKED
- **Master Blueprint:** COMPLETE / LOCKED THROUGH MB-12 / REPOSITORY FINALIZED
- **Production Blockers Backlog:** CREATED / REGISTERED / GIT FINALIZED
- **Production Blockers:** 12 OPEN / CARRIED FORWARD
- **Resolved / Closed:** 0
- **Owner Carry-Forward:** APPROVED
- **Architecture Phase:** AUTHORIZED / ACTIVE
- **Substantive Architecture Design:** NOT STARTED
- **Build:** NOT AUTHORIZED

## 3. Control Principles

1. Repository authority wins over chat/reports.
2. LOCKED/FROZEN product decisions cannot be silently changed.
3. Architecture translates canonical WHAT into controlled HOW.
4. Architecture may preserve or enable Production Blocker closure but may not falsely mark blockers resolved.
5. Architecture decisions must preserve canonical domain distinctions.
6. Secure Assessment is mission-critical and must receive explicit Architecture treatment before Build authorization.
7. Architecture work proceeds through small auditable units.
8. One unit must be verified before progression to the next.
9. Build remains prohibited until Architecture exit criteria pass and CURRENT_STATE explicitly authorizes Build.
10. No Architecture index entry by itself constitutes a technical decision.

## 4. Required Architecture Coverage Register

The following concerns are REQUIREMENTS TO BE RESOLVED.

1. system/component boundaries: UNRESOLVED / NOT YET DESIGNED
2. multi-tenant isolation: UNRESOLVED / NOT YET DESIGNED
3. Person / User Account / Membership separation: UNRESOLVED / NOT YET DESIGNED
4. authorization model and scoped capabilities: UNRESOLVED / NOT YET DESIGNED
5. Academic Core shared truth: UNRESOLVED / NOT YET DESIGNED
6. Secure Assessment mission-critical isolation: UNRESOLVED / NOT YET DESIGNED
7. No Lost Answers architecture: UNRESOLVED / NOT YET DESIGNED
8. server-authoritative timer: UNRESOLVED / NOT YET DESIGNED
9. idempotent submission: UNRESOLVED / NOT YET DESIGNED
10. Exam Participant / Exam Attempt / Exam Session separation: UNRESOLVED / NOT YET DESIGNED
11. immutable Exam Question Snapshot: UNRESOLVED / NOT YET DESIGNED
12. data trust/provenance boundaries: UNRESOLVED / NOT YET DESIGNED
13. privacy and restricted Care data: UNRESOLVED / NOT YET DESIGNED
14. Partner purpose-limited access: UNRESOLVED / NOT YET DESIGNED
15. Student -> Alumni lifecycle continuity: UNRESOLVED / NOT YET DESIGNED
16. cross-domain contracts: UNRESOLVED / NOT YET DESIGNED
17. consistency/transaction boundaries: UNRESOLVED / NOT YET DESIGNED
18. reliability/failure containment: UNRESOLVED / NOT YET DESIGNED
19. backup/restore architecture support: UNRESOLVED / NOT YET DESIGNED
20. security/incident-readiness architecture support: UNRESOLVED / NOT YET DESIGNED
21. auditability/observability: UNRESOLVED / NOT YET DESIGNED
22. external integration boundaries: UNRESOLVED / NOT YET DESIGNED
23. data retention/deletion architecture hooks: UNRESOLVED / NOT YET DESIGNED
24. deployment/runtime boundaries: UNRESOLVED / NOT YET DESIGNED
25. technology-selection criteria: UNRESOLVED / NOT YET DESIGNED
26. migration/bootstrap strategy: UNRESOLVED / NOT YET DESIGNED

## 5. Production Blocker Architecture Tracking

### PB-01
- **NAME:** Controller / Processor Legal Allocation
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE HOOK / LATER CLOSURE
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture may expose clear processing/data-flow boundaries.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT resolve legal Controller/Processor allocation.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-02
- **NAME:** Final Retention Periods / Retention Matrix
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE HOOK / LATER CLOSURE
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must support configurable retention/deletion enforcement.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT invent retention periods.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-03
- **NAME:** Required DPIA
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE HOOK / LATER LEGAL/PRIVACY CLOSURE
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture may provide processing/data-flow evidence useful to DPIA.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT determine whether DPIA is legally required or completed.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-04
- **NAME:** Full Authentication Policy / Authentication-Security Policy
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE-RELEVANT
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must support authentication/security policy enforcement.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT claim the final Authentication-Security Policy is approved.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-05
- **NAME:** Permission Matrix
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE-RELEVANT
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must support scoped permission/capability enforcement.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT claim the Permission Matrix exists or is approved.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-06
- **NAME:** Assessment Capability Testing
- **ARCHITECTURE RELEVANCE:** LATER IMPLEMENTATION / TESTING CLOSURE
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must make applicable capabilities testable.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT claim Assessment Capability Testing has passed.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-07
- **NAME:** Zero-Lost-Answer Verification
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE-CRITICAL / LATER VERIFICATION CLOSURE
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must address No Lost Answers requirements.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT claim Zero-Lost-Answer verification is complete.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-08
- **NAME:** Care Safeguarding Rules / Policy
- **ARCHITECTURE RELEVANCE:** CONDITIONAL — CARE
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must preserve restricted Care access/safeguarding hooks.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT resolve Care safeguarding policy.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-09
- **NAME:** Partner Verification / Moderation Policy
- **ARCHITECTURE RELEVANCE:** CONDITIONAL — PARTNER
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must preserve purpose-limited Partner access and moderation hooks.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT resolve Partner verification/moderation policy.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-10
- **NAME:** Data Classification + Consent Governance
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE-RELEVANT
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must support data classification and consent enforcement hooks.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT claim governance artifact closure.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-11
- **NAME:** Backup + Restore Verification
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE HOOK / LATER RUNTIME VERIFICATION
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must support backup/restore capability.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT claim successful restore verification.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

### PB-12
- **NAME:** Security / Incident-Response Readiness
- **ARCHITECTURE RELEVANCE:** ARCHITECTURE HOOK / LATER SECURITY/OPERATIONS CLOSURE
- **ARCHITECTURE MUST PRESERVE / ENABLE:** Architecture must support incident-response/security readiness.
- **ARCHITECTURE MUST NOT CLAIM:** Do NOT claim operational readiness.
- **CLOSURE STATUS:** OPEN / CARRIED FORWARD

## 6. Architecture Workstream Sequence

**WORKSTREAM SEQUENCE AUTHORITY:** CONTROL-APPROVED ORDER  
**FIXED ARCHITECTURE UNIT IDS:** NONE  
**ARCHITECTURE UNIT NAMING CONVENTION:** NOT YET ESTABLISHED  
**TECHNICAL SPECIFICATION:** NO  

### SEQUENCE 0: Architecture Control & Traceability Bootstrap
- **Purpose:** phase control, coverage tracking, authority/gates.
- **CONTROL BOOTSTRAP:** COMPLETE

### SEQUENCE 1: System & Domain Boundaries
- **Purpose:** system context, component/domain responsibility boundaries, isolation needs.
- **STATUS:** PENDING

### SEQUENCE 2: Data / Tenancy / Trust Architecture
- **Purpose:** data ownership, tenant isolation, lifecycle continuity, provenance, consistency requirements.
- **STATUS:** PENDING

### SEQUENCE 3: Identity / Access / Security Architecture
- **Purpose:** Person/User/Membership separation, scoped authorization, authentication architecture requirements, privacy/security enforcement boundaries.
- **STATUS:** PENDING

### SEQUENCE 4: Secure Assessment Critical Architecture
- **Purpose:** mission-critical containment, No Lost Answers, timer authority, idempotency, attempt/session/participant distinctions, immutable snapshots.
- **STATUS:** PENDING

### SEQUENCE 5: Cross-Domain & Integration Architecture
- **Purpose:** canonical cross-domain contracts and external integration boundaries.
- **STATUS:** PENDING

### SEQUENCE 6: Runtime / Reliability / Operations Architecture
- **Purpose:** runtime boundaries, failure containment, observability, backup/restore, incident-response hooks, deployment requirements, technology-selection criteria.
- **STATUS:** PENDING

### SEQUENCE 7: Architecture Traceability & Exit Gate
- **Purpose:** verify coverage, unresolved blockers, contradictions, Architecture exit readiness and Build-entry eligibility.
- **STATUS:** PENDING

## 7. Specific Premature Assumptions to Exclude

This file MUST NOT state or imply that any of the following are selected:
- PostgreSQL / Postgres
- specific database engine
- specific schema strategy
- cross-domain FK strategy
- RBAC
- ABAC
- token/JWT/session mechanism
- specific auth provider
- specific framework
- specific programming language
- specific frontend/backend stack
- specific API protocol
- specific endpoint naming
- sync-vs-async implementation choice
- event bus/message broker
- cloud/vendor selection
- deployment topology
- InsForge implementation decision

These remain unresolved unless later repository authority decides them.

## 8. ADR / Decision Record Treatment

- **Architecture-specific ADR convention:** NOT YET ESTABLISHED
- **Existing global decision record:** docs/decisions/DECISION_LOG.md

## 9. Exit-Gate Treatment

- **Architecture exit gate:** EXPECTED FROM PROJECT PHASE-GATE CONVENTION / NOT YET CANONICALIZED

## 10. Next Safe Action

- **ACTIVE ARCHITECTURE UNIT:** NONE
- **ARCHITECTURE INDEX STATUS:** ACTIVE / CONTROL BASELINE
- **INDEX REGISTRATION:** COMPLETE
- **INDEX GIT FINALIZATION:** NOT YET PERFORMED
- **CONTROL WORKSTREAM ORDER:** APPROVED
- **SUBSTANTIVE ARCHITECTURE DESIGN:** NOT STARTED
- **NEXT SAFE ACTION:** ARCHITECTURE PHASE INDEX GIT FINALIZATION
- **BUILD:** NOT AUTHORIZED
