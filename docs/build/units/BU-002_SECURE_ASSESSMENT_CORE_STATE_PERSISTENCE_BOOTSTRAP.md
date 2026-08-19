# BU-002: Secure Assessment Core State Persistence Bootstrap

**Build Unit:** BU-002
**Status:** REGISTERED / READY FOR IMPLEMENTATION
**Phase:** BUILD
**Implementation:** NOT EXECUTED
**Registration Owner Acceptance:** COMPLETE
**Registration Git Finalization:** COMPLETE
**Registration Git Finalization Commit:** 9ec67f1a1a4c782337b69a8d035942afa06b55e1
**Registration Repository Finalized:** YES
**Implementation Repository Finalized:** NO
**Done:** NO
**Secure Assessment Implementation:** NOT STARTED

## PURPOSE
Register the first Secure-Assessment-priority Build Unit after the fully closed BU-001 minimum foundation. This is deliberately the smallest persistence-level Secure Assessment foundation following BU-001.

## IN SCOPE
BU-002 scope is limited to persistence foundation for exactly these four Secure Assessment concepts:
1. Exam Instance
2. Exam Participant
3. Exam Attempt
4. Exam Session

The specification may define implementation requirements and verification expectations for a later execution. This registration execution MUST NOT create their physical implementation. BU-002 implementation has NOT started. No physical schema is created by registration.

## OUT OF SCOPE
BU-002 explicitly excludes:
- Assessment Type implementation
- Question Bank Item implementation
- immutable Exam Question Snapshot implementation
- answer persistence / answer acknowledgement implementation
- Zero-Lost-Answer runtime implementation
- server-authoritative timer implementation
- submission implementation
- Submission Receipt implementation
- reconnect/resume runtime implementation
- Retake workflow implementation
- question authoring
- question delivery
- scoring
- Official School Grade
- Track integration
- Violation Event persistence
- Risk Signal persistence
- Incident persistence
- Cheating Decision persistence
- anti-cheating heuristics
- proctoring runtime
- Exam Room implementation
- authentication implementation
- permission matrix implementation
- frontend
- backend API endpoints
- application framework initialization
- mobile
- AI / AI proctoring
- Care
- Partner
- Passport
- Path
- Opportunity
- Learn
- general timetable
- general attendance
- deployment infrastructure
- production hosting
- PB closure

## UPSTREAM AUTHORITIES
- docs/01-discovery/04.01_SECURE_ASSESSMENT.md
- docs/02-master-blueprint/02.04_CORE_JOURNEYS_AND_CRITICAL_FLOWS.md
- docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md
- docs/build/units/BU-001_MINIMUM_FOUNDATION_IDENTITY_TENANT_PERSISTENCE_BOOTSTRAP.md

## CANONICAL INVARIANTS
BU-002 MUST preserve these canonical distinctions:
- Student != Exam Participant != Exam Attempt != Exam Session
- Assessment Type != Exam Instance
- Question Bank Item != immutable Exam Question Snapshot
- Teacher != Proctor
- RECONNECT != RETAKE
- Violation Event != Risk Signal != Incident != Cheating Decision
- Risk Signal != verdict

## DOMAIN OWNERSHIP BOUNDARY
Secure Assessment is authoritative for assessment-domain state, while Identity / Tenant / Academic Core upstream truths remain owned by their canonical source domains.

## CROSS-DOMAIN MATURITY SAFETY
Person / User Account / Membership remain owned outside Secure Assessment.
Tenant remains owned outside Secure Assessment.
Secure Assessment must not silently re-own those source truths.
The global cross-domain FK / event strategy remains PROVISIONAL.
Therefore the BU-002 registration MUST NOT globally mandate direct cross-domain foreign keys. Any implementation-time reference from Secure Assessment toward externally owned Identity/Tenant/Academic truth must remain subject to the later Build-unit-specific ownership/consistency decision allowed by the locked Architecture.

## TECHNOLOGY MATURITY
PostgreSQL: SELECTED FOR BU-001 PERSISTENCE
Plain SQL Versioned Git Migrations: SELECTED FOR BU-001
For BU-002, repository may reuse the verified persistence foundation only where justified by current Build authority.

DO NOT claim:
- PostgreSQL major 18 is globally selected.
- final backend language selected.
- final framework selected.
- final frontend selected.
- final deployment topology selected.
- final global technology stack selected.

Any BU-002-specific technology use is distinguished from global technology selection.

## IMPLEMENTATION PRECONDITIONS
- BU-001 MUST be COMPLETE and DONE.
- PB Backlog MUST be registered.
- BU-002 MUST be registered and in a separate bounded execution.

## LATER IMPLEMENTATION WRITE BOUNDARY
Implementation will be constrained to exactly the tables for Exam Instance, Exam Participant, Exam Attempt, and Exam Session.

## VERIFICATION EXPECTATIONS
- No expansion of scope.
- Structural metadata assertions.

## DONE CRITERIA
- Migration executed successfully.
- Verification script passes.
- Terminal verification pass.
- Repository finalized.

## FAIL / BLOCKED CONDITIONS
- Scope expansion into out-of-scope areas.
- Alteration of canonical invariants.
- Premature global technology selection.

## PRODUCTION BLOCKER RELATIONSHIP
BU-002 is structural groundwork only. No Production Blocker closes.
DO NOT claim that BU-002 alone implements or verifies:
- ZERO LOST ANSWERS
- server-authoritative timer
- idempotent submission
- reconnect/resume
- active-exam failure isolation
- PB-06 Assessment Capability Testing closure
- PB-07 Zero-Lost-Answer Verification closure
- PB-11 Backup/Restore closure
- PB-12 Security/Incident readiness closure

## SECURE ASSESSMENT CONTINUATION BOUNDARY
Any feature beyond Exam Instance, Participant, Attempt, and Session must be implemented in a subsequent registered unit.
