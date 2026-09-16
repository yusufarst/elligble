**Status:** ACTIVE / STAGE-2 COMPLETE / AWAITING CONTROLLER PHYSICAL AUDIT
**Version:** 1.0.4
**Canonical:** CANONICAL BUILD UNIT RECORD
**Phase:** BUILD
**Build Unit:** BU-085
**Title:** Secure Assessment Student Assigned Exam Discovery Read API and Browser UI Integration Bootstrap

## 1. Description / Purpose
BU-085 reduces the active Milestone-1 gap: FULL BROWSER-FACING ASSIGNED-EXAM DISCOVERY.

It delivers a bounded authoritative read-only vertical slice:
trusted student context -> Secure Assessment persisted assignment/attempt state -> assigned-exam discovery HTTP read API -> browser UI -> handoff to existing BU-084 launch flow.

## 2. Trust / Security Boundary
Freeze required injected trusted context:
- tenantId
- personId

These values come from the surrounding trusted authentication seam.

BU-085 MUST NOT define or implement:
- login
- JWT semantics
- Bearer semantics
- cookie/session technology
- OAuth
- OIDC
- SAML
- password mechanics
- request-header impersonation
- authentication provider
- final Permission Matrix

Missing tenantId or personId: FAIL CLOSED / DENY.
No cross-tenant widening.

PB04: OPEN
PB05: OPEN
PB06: OPEN
PB07: OPEN
BU-085 does not close any Production Blocker.

## 3. Exact Read API Boundary
Freeze exact bounded route: `GET /api/v1/assessment/assigned-exams`
It is READ ONLY.

Authoritative relation:
trusted tenantId + personId -> secure_assessment_exam_participants -> secure_assessment_exam_instances -> zero / one / multiple secure_assessment_exam_attempts.

No mutation.
No participant creation.
No attempt creation.
No session creation.
No timer start.
No submission.
No answer mutation.
No migration/schema change.

## 4. Assignment / Attempt Semantics
Exam Participant is assignment truth for this bounded discovery capability.

- Assignment with zero attempts: VISIBLE, NON-LAUNCHABLE.
- Assignment with one existing launchable attempt: return exact persisted attemptId.
- Assignment with multiple attempts: preserve every distinct attempt. NO COLLAPSE. NO IMPLICIT SELECTION.
- Original / susulan attempts: must remain distinct records.
- Submitted/non-launchable attempt: may remain visible as historical/non-launchable state. must not be presented as a new launchable attempt.

Discovery UI itself must never create an attempt.

## 5. Browser UI Boundary
Freeze Stage-2 browser scope:
- typed assigned-exam discovery client
- mobile-first responsive assigned-exam discovery UI
- loading state
- empty assigned-exam state
- assignment without attempt
- single launchable attempt
- multiple distinct attempts
- submitted/non-launchable attempt
- forbidden / missing trusted context
- API failure

A launch action:
- must use the exact server-returned existing attemptId
- must hand off to the existing BU-084 AttemptLaunch flow
- must NOT create a second exam-engine flow
- must NOT expose manual UUID entry
- must NOT fabricate attempt IDs or assignment data

## 6. Display Data Boundary
Only display data physically derivable from existing persisted state and existing authoritative projections.

Do NOT invent: schedule, duration, status taxonomy, subject, room, attempt label, display label unless physically derivable from existing canonical data/contracts.

Prefer existing authoritative Subject/context projection when physically available.

UI language: Bahasa Indonesia. No user-facing em dash.

## 7. Required Predecessors vs Reused Assets

### REQUIRED PREDECESSORS
- **BU-002:** Required for authoritative Secure Assessment schema and participant core state persistence.
- **BU-083:** Required for authoritative student exam context projection structure.
- **BU-084:** Required for browser handoff dependency to existing pre-start attempt launch flow.

### REUSED SUPPORTING ASSETS
- LOCKED frontend design system and `frontend/web/src` foundation.
- Existing secure assessment runtime tests and server integration structures.

## 8. Verification Obligations
Freeze Stage-2 verification requirements:
- runtime typecheck
- focused runtime/API tests
- relevant server regression tests

**REAL POSTGRESQL verification: REQUIRED**
Real PostgreSQL proof minimum:
- correct tenant + person discovery
- cross-tenant denial/isolation
- wrong-person isolation
- zero assignment
- assignment without attempt
- one attempt
- multiple attempts preserved distinctly
- submitted/non-launchable behavior

**Frontend:**
- typecheck
- focused automated tests
- production build

**RENDERED QA: REQUIRED**
Rendered QA minimum:
- desktop assigned-exam discovery
- mobile assigned-exam discovery
- empty state
- assignment without attempt
- one launchable attempt
- multiple distinct attempts
- forbidden/API failure
- successful handoff to BU-084 using server-provided attemptId

Rendered screenshots do not replace automated/runtime verification.

## 9. Stage-2 Authorized Path Classes
Freeze future Stage-2 path classes.

**AUTHORIZED:**
- `runtime/secure-assessment/src/`: one bounded assigned-exam discovery module, bounded server.ts route integration
- `runtime/secure-assessment/test/`: focused BU-085 runtime/server tests
- `runtime/secure-assessment/verification/`: BU-085 real-PostgreSQL verifier
- `frontend/web/src/`: assigned-exam client/types, discovery component/view, bounded entry/navigation integration, focused tests, bounded related styling, required lifecycle documentation

**NOT AUTHORIZED:**
- `database/migrations/**`
- database schema mutation
- package.json, lockfiles, new dependencies
- authentication provider/login implementation
- Permission Matrix definition
- Proctor UI, Teacher UI
- unrelated runtime modules
- BU-084 modification
- production-blocker closure

## 10. Owner Decision / Stop Conditions
OWNER DECISION REQUIRED: NO
provided implementation remains inside frozen boundary.

STOP and return to Controller if Stage-2 would require:
- new schema/migration
- new authentication/security policy
- Permission Matrix decision
- attempt-creation policy
- implicit choice between multiple attempts
- architecture supersession
- LOCKED/FROZEN contradiction
- unsupported data/display semantics

## 11. Execution State
- **STAGE-1:** PASS / FROZEN
- **STAGE-1 CONTROLLER PHYSICAL RE-AUDIT:** PASS
- **STAGE-2:** COMPLETE
- **ENGINEERING VERIFICATION:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **FRONTEND TYPECHECK:** PASS
- **FRONTEND TEST:** PASS
- **FRONTEND BUILD:** PASS
- **RENDERED QA:** PASS
- **BU-084 HANDOFF:** PASS
- **IMPLEMENTATION REPOSITORY FINALIZED:** YES
- **STAGE-3:** PENDING / AWAITING CONTROLLER PHYSICAL AUDIT
- **DONE:** NO
- **TERMINAL:** NO
- **FULL BU REPOSITORY FINALIZED:** NO
- **PB04:** OPEN
- **PB05:** OPEN
- **PB06:** OPEN
- **PB07:** OPEN
