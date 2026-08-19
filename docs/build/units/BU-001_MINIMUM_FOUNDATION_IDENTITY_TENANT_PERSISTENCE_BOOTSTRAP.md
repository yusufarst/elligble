**Build Unit:** BU-001
**Status:** REGISTERED / NOT STARTED
**Phase:** BUILD
**Implementation:** NOT EXECUTED

# BU-001: Minimum Foundation: Identity/Tenant Persistence Bootstrap

## PURPOSE
Establish the smallest persistence-level foundation required for canonical identity and tenant context while avoiding unrelated platform breadth.

## IN SCOPE
- Person schema
- User Account schema
- Tenant schema
- Membership schema
- Persistence tooling (PostgreSQL) and versioned Git migration setup

## OUT OF SCOPE
- Academic Core schema
- Secure Assessment implementation
- API endpoints
- frontend product functionality
- Care
- Partner
- Passport
- Path
- Opportunity
- Learn
- Track
- AI
- general timetable
- general attendance

## UPSTREAM AUTHORITIES
- `docs/01-discovery/02.01_TENANT_ORGANIZATION_IDENTITY_ACCESS.md`
- `docs/architecture/DATA_TENANCY_AND_TRUST_ARCHITECTURE.md`
- `docs/architecture/IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE.md`

## CANONICAL INVARIANTS
- Person != User Account != Membership
- Organization != Tenant
- one school = one academic tenant baseline
- tenant isolation
- one domain owns truth
- no silent cross-domain writes

## TECHNOLOGY DECISIONS
- **selected for BU-001:**
  - PostgreSQL (Persistence/Database Engine): Justified against repository criteria for ACID compliance (Zero-Lost-Answer compatibility), strict logical domain ownership, and physical/logical schema separation (tenant isolation, no silent cross-domain writes).
  - Plain SQL Versioned Git Migrations: Justified by the strict "Versioned Git migrations only" constraint. Provides migration/bootstrap safety without prematurely forcing a backend language runtime.
  - Native PostgreSQL test tooling (e.g., `psql` validation): Justified by the terminal verification requirement, ensuring testability without heavy external tooling.
- **allowed but not selected:**
  - InsForge (deferred until required)
  - Modular monolith runtime backend (Node.js/Go/etc. allowed but deferred)
- **deferred:**
  - Frontend framework
  - Final deployment topology
  - Backend API runtime
  - Mobile stack
  - Broker/event bus
- **not required:**
  - AI technology
  - Unrelated integration technology

## IMPLEMENTATION PRECONDITIONS
- Build Phase Entry Control Bootstrap completed and APPROVED.
- Git working tree clean.

## LATER IMPLEMENTATION WRITE BOUNDARY
- Migration files (e.g., `.sql`) within a defined migration directory.
- Test scripts for terminal verification.
- Documentation updates (CURRENT_STATE, etc.)

## VERIFICATION MATRIX
- Typecheck/Lint: SQL syntax validation.
- Migration Status: Forward migration execution success.
- Security Checks: Cross-domain write prevention validation, tenant isolation structure verified.
- Git Status: Clean commit ready.

## DONE CRITERIA
- BU-001 migrations execute cleanly.
- Terminal verification passes.
- State synchronized.

## FAIL / BLOCKED CONDITIONS
- Inability to verify tenant isolation at the schema level.
- Migration conflicts or failure to execute natively.

## PRODUCTION BLOCKER RELATIONSHIP
- PB-04, PB-10: BU-001 schemas will provide the foundation for later authentication and consent data models, but DOES NOT close the blockers.
- CLOSES: NONE

## SECURE ASSESSMENT HANDOFF
- This foundation is required before Secure Assessment can assign Participants or Authorize Exams. Secure Assessment remains the highest implementation priority after this verified minimum foundation.
