# BU-086 Specification

**Title:** Secure Assessment Proctor Room and Active Session Monitoring Read API and Browser UI Integration Bootstrap
**Version:** 1.0.2
**Status:** ACTIVE / STAGE-1 PASS / FROZEN / INITIAL CONTROLLER PHYSICAL AUDIT FAIL / TARGETED FORWARD CORRECTION COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PASS / STAGE-2 AUTHORIZED / NOT STARTED

## PURPOSE:
Reduce the explicit Milestone-1 gap:
Proctor operational UI — minimal room and active-session monitoring view.

## BOUNDARY:
trusted Proctor context
-> existing explicit Proctor assignment authorization
-> existing assigned Exam / Exam Room scope
-> participant-room/session persisted state
-> bounded read API
-> mobile-first responsive browser UI.

## TRUST CONTEXT:
- tenantId
- personId

These values remain supplied by the existing trusted authentication seam.

## MUST NOT DEFINE OR IMPLEMENT:
- login
- authentication provider
- JWT
- Bearer semantics
- cookies/session technology
- OAuth
- OIDC
- SAML
- password mechanics
- MFA policy
- request-header impersonation
- final Permission Matrix

Missing required trusted context:
FAIL CLOSED / DENY.

## PB04:
OPEN

## PB05:
OPEN

## PB06:
OPEN

## PB07:
OPEN

BU-086 closes no Production Blocker.

## EXACT READ API:
GET /api/v1/assessment/proctor-monitoring

READ ONLY.

## AUTHORITATIVE RELATION:
trusted tenantId + personId
-> explicit active Proctor assignment
-> assigned Exam Instance scope
-> assigned Exam Room / Proctor-Room mapping
-> Participant-Room assignment
-> existing Attempt / active Session state.

## MINIMUM RESPONSE SEMANTICS:
- preserve every assigned Exam/Room independently
- room identifier internally as required
- room display label only when physically persisted/authoritatively derivable
- assigned participant count per authorized room
- authoritative active-session count per authorized room
- exam/room with zero active sessions remains representable
- Proctor assignment with zero mapped rooms remains representable
- revoked/inactive Proctor assignment must not grant monitoring access
- no cross-tenant widening
- no participant Person PII/details introduced by this BU
- no invented status taxonomy
- no fabricated schedule/duration/labels

## BROWSER UI:
- typed Proctor monitoring client
- mobile-first responsive monitoring view
- loading
- no assigned monitoring scope
- assigned Exam with zero rooms
- room with zero active sessions
- one/multiple assigned rooms
- current active-session counts
- forbidden/missing trusted context
- API failure
- manual refresh may be used
- no manual UUID entry

## NOT AUTHORIZED:
- mutations
- session activation/takeover/supersession/termination
- participant reassignment
- proctor reassignment
- violation/cheating verdicts
- messaging
- screenshots/camera
- WebSocket
- automatic polling
- Teacher UI
- student UI changes
- authentication implementation
- Permission Matrix definition
- database migration/schema changes
- package.json/lockfile/new dependency
- Production Blocker closure
- BU-085 reopening

## REQUIRED PREDECESSOR / REUSED ASSETS:
- BU-017 — One-Active-Session core state
- BU-018 — Governed Session Activation / Supersession
- BU-034 — Explicit Proctor Assignment persistence
- BU-035 — Explicit Proctor Assignment authorization
- BU-071 — Exam Room persistence
- BU-072 — Participant Room Assignment persistence
- BU-073 — Proctor Room Assignment persistence
- existing Secure Assessment HTTP server foundation
- existing React + TypeScript + Vite frontend foundation
- LOCKED frontend design/copy rules

## STAGE-2 VERIFICATION OBLIGATIONS TO FREEZE NOW:
### Runtime:
- typecheck
- focused API/runtime tests
- relevant server regressions

### REAL POSTGRESQL REQUIRED:
- authorized same-tenant assigned Proctor
- wrong Proctor denied / no leakage
- revoked/inactive Proctor denied
- cross-tenant denial
- zero assigned Exam
- assigned Exam with zero rooms
- one room
- multiple rooms preserved independently
- room participant count scope correctness
- zero active sessions
- one/multiple authoritative active sessions
- unrelated room/session exclusion
- zero mutation
- disposable database cleanup / fail-closed

### Frontend:
- typecheck
- focused automated tests
- production build

### RENDERED QA REQUIRED:
- desktop populated monitoring
- mobile populated monitoring
- no assignment
- zero rooms
- zero active sessions
- multiple rooms
- forbidden
- API failure

## OWNER DECISION REQUIRED:
NO, provided implementation stays inside this frozen boundary.

STOP AND RETURN TO CONTROLLER IF FUTURE STAGE-2 REQUIRES:
- authentication/security-policy decision
- Permission Matrix decision
- participant-level PII expansion
- new schema/migration
- new dependency
- mutation/action semantics
- WebSocket/polling architecture decision
- architecture supersession
- LOCKED/FROZEN contradiction
- unsupported display semantics
- Production Blocker closure.

## STAGE-1 REGISTRATION PROCESS TRUTH
- **PROCESS DEVIATION:** YES
- **DETAIL:** Antigravity displayed one background process after the Stage-1 completion claim despite foreground-only instruction.
- **CLASSIFICATION:** NON-MATERIAL EXECUTION-CONTROL DEFECT.
- **REPOSITORY EFFECT:** candidate remained local and unpushed; exact six-path registration scope preserved; no product/runtime/frontend/database implementation mutation occurred.
- **STAGE-2:** AUTHORIZED / NOT STARTED.

## STAGE-1 CONTROLLER PHYSICAL AUDIT / TARGETED FORWARD CORRECTION
- **INITIAL CONTROLLER PHYSICAL AUDIT:** FAIL.
- **MATERIAL FINDING:** `DOCUMENT_MANIFEST.md` duplicate descriptive rows for Handoff and Build retained stale pre-BU-086 navigation semantics even though their versions and SHA256 values were updated.
- **FROZEN SCOPE MATERIAL AUDIT:** PASS.
- **TARGETED FORWARD CORRECTION:** COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PASS.
- **CONTROLLER PHYSICAL RE-AUDIT:** PASS.
- **CONTROLLED PUSH PROCESS DEVIATION:** YES. The pre-push root-string equality check rejected equivalent slash formatting; interactive execution nevertheless continued through the normal non-force push.
- **PROCESS DEVIATION CLASSIFICATION:** NON-MATERIAL EXECUTION-CONTROL DEFECT; physical repository identity, exact six-path candidate, non-force push, `HEAD == origin/main`, divergence `0/0`, and clean final tree were preserved.
- **STAGE-2:** AUTHORIZED / NOT STARTED.
