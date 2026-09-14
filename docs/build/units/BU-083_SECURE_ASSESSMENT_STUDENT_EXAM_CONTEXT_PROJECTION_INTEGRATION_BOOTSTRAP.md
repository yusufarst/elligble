# BU-083: Secure Assessment Student Exam Context Projection Integration Bootstrap

## Overview
This Build Unit extends the existing Secure Assessment runtime readback response contract to project read-only, authoritative Subject and Exam Room display context for an already-authorized exam attempt, and consumes this context in the Exam Workstation frontend to fulfill the locked presentation waterfall without requiring new tenant-authorization boundaries.

## Scope
- IN-SCOPE:
  - read-only authoritative Subject context derivation for the already authorized attempt;
  - read-only authoritative Exam Room context derivation for the already authorized attempt;
  - extension of the existing assessment readback response contract with typed optional context data;
  - frontend consumption of authoritative context;
  - locked fallback: Subject -> Room -> OMIT;
  - tenant-safe read semantics;
  - verification required to prove no writes occur.

- OUT-OF-SCOPE:
  - authentication provider/mechanism design;
  - PB04 closure;
  - PB05 permission matrix or client-driven authorization adjustments;
  - backend mutation endpoints;
  - UI state other than the presentation of contextual header labels.

## Dependencies
- Predecessors:
  - BU-082 (Secure Assessment Student Exam Client Mobile-First UX Hardening Bootstrap)
  - BU-072 (Secure Assessment Exam Participant Room Assignment Core State)
  - BU-044 (Secure Assessment Exam Instance Teaching Assignment Context)

## Architecture Integrity
- No writes are performed. Database isolation level `REPEATABLE READ READ ONLY` is strictly maintained.
- Tenant ID scoping is fully preserved on all database queries and table joins.

## Lifecycle Status
- **IMPLEMENTATION:** COMPLETE
- **ENGINEERING VERIFICATION:** PASS
- **RENDERED QA:** BLOCKED / ENVIRONMENT
- **STAGE-3 PHYSICAL AUDIT:** PENDING
- **STAGE-4 LIFECYCLE CLOSE:** NOT AUTHORIZED
