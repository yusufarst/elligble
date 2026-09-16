# BU-087 Specification

**Title:** Secure Assessment Teacher Scheduled Exam and Readiness Inspection Read API and Browser UI Integration Bootstrap
**Version:** 1.0.1
**Status:** ACTIVE / SELECTED / SCOPE FROZEN / INITIAL STAGE-1 CONTROLLER PHYSICAL AUDIT FAIL / TARGETED PROCESS-TRUTH FORWARD CORRECTION COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PENDING / STAGE-2 NOT AUTHORIZED

## PURPOSE:
Reduce the active Milestone-1 gap:
Teacher delivery/readiness — minimal scheduled exam and readiness inspection read API and mobile-first browser inspection view.

Provide a bounded READ-ONLY Teacher-facing API and browser view for the Teacher's own same-tenant SCHEDULED teacher-managed Exam Instances and their existing authoritative readiness results.

## BOUNDARY:
Trusted Teacher context
-> active Tenant Teacher Assignment (revoked_at IS NULL)
-> active Academic Core Teaching Assignment (revoked_at IS NULL)
-> same-tenant secure_assessment_exam_instances.teaching_assignment_id
-> SCHEDULED Exam Instances only
-> authoritative readiness composition preflights (BU-068 + BU-077)
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
- cookies/session mechanics
- OAuth
- OIDC
- SAML
- password mechanics
- MFA policy
- request-header impersonation
- final Permission Matrix
- PB04 closure
- PB05 closure

Missing required trusted context:
FAIL CLOSED / DENY.

## PRODUCTION BLOCKERS:
- PB04: OPEN
- PB05: OPEN
- PB06: OPEN
- PB07: OPEN

BU-087 closes no Production Blocker.

## EXACT READ API:
GET /api/v1/assessment/teacher-readiness

READ ONLY.
No mutation.

## AUTHORITATIVE RELATION / DATA AUTHORIZATION:
Trusted Teacher context: { tenantId, personId }

Authorize only through existing persisted relation:
tenant_memberships
-> active tenant_teacher_assignments (revoked_at IS NULL)
-> active academic_core_teaching_assignments (revoked_at IS NULL)
-> secure_assessment_exam_instances.teaching_assignment_id

Only same-tenant Exam Instances belonging to that Teacher's active Teaching Assignment may be projected.
Only SCHEDULED Exam Instances belong in this BU's readiness view.

Authorization rules:
- Wrong Teacher: NO LEAK.
- Revoked Teacher Assignment: NO ACCESS.
- Revoked Academic Core Teaching Assignment: NO ACCESS.
- Cross-tenant: NO LEAK.

## FROZEN READINESS COMPOSITION:
Reuse existing verified runtime assets.
For each authorized SCHEDULED Exam Instance, compose:
A. `checkExamInstanceBaselineReadinessChecksCompositionPreflight` from BU-068 (including its existing schedule-conflict composition)
B. `checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight` from BU-077

Preserve their authoritative result semantics.
The API may safely project existing result categories/blockers required for the Teacher inspection view.

MUST NOT:
- transition SCHEDULED -> READY
- mutate lifecycle
- invent a new readiness policy
- silently collapse unavailable/denied/invalid_state into ready
- widen Teacher into Proctor
- expose unrelated Teacher/Student PII

Subject/group labels may be exposed only where already persisted and authoritatively derivable from existing Academic Core relations.
Do not invent schedule, duration, display label, readiness state, or completion semantics that do not exist physically.

## FROZEN BROWSER UI:
Mobile-first Teacher readiness inspection view.

Required eventual states:
- loading
- no scheduled exams
- one scheduled exam
- multiple scheduled exams
- baseline readiness pass
- baseline not-ready blocker
- room/proctor readiness ready
- room/proctor readiness not applicable
- room/proctor readiness blocker
- forbidden/missing trusted context
- API unavailable/failure
- manual refresh

No manual UUID input.
Bahasa Indonesia user-facing copy.
Follow canonical frontend design/copy rules (EM DASH "—" prohibited in user-facing UI copy).
No polling.
No WebSocket.

## EXPLICITLY OUT OF SCOPE:
DO NOT AUTHOR OR IMPLEMENT:
- Teacher mutation/actions
- Exam Instance creation/editing
- scheduling mutation
- SCHEDULED -> READY transition
- activation
- participant assignment changes
- proctor assignment changes
- completion-rate monitoring
- result/scoring UI
- cheating/incident verdicts
- messaging
- Student UI changes
- Proctor UI changes
- real authentication implementation
- Permission Matrix
- PB04/PB05/PB06/PB07 closure
- schema/migration
- package/lock/dependency changes
- WebSocket
- auto-polling
- new architecture decision
- BU-088 or any successor work

## FROZEN IMPLEMENTATION PATH CLASSES FOR FUTURE STAGE-2:
Stage-2 may later use only bounded classes such as:
runtime/secure-assessment/src/
- new teacher-readiness handler/composition
- server.ts route integration

runtime/secure-assessment/test/
- focused teacher-readiness tests
- relevant server regression only

runtime/secure-assessment/verification/
- one BU-087 real PostgreSQL verifier

frontend/web/src/
- existing assessment types/client/App integration
- one Teacher readiness component
- one bounded stylesheet
- focused component tests

canonical BU/control docs required by lifecycle synchronization.

NO migration/schema/package/dependency path.
If Stage-2 later needs another material path class: STOP for Controller review.

## FROZEN FUTURE VERIFICATION REQUIREMENTS:
Record these in the BU-087 spec; DO NOT run them now.

Runtime:
- strict/package typecheck
- focused Teacher-readiness API/runtime tests
- relevant server regressions

Real PostgreSQL:
- authorized same-tenant Teacher
- wrong same-tenant Teacher no leak
- revoked Teacher assignment denied/excluded
- revoked Teaching Assignment denied/excluded
- cross-tenant no leak
- zero scheduled exams
- one scheduled exam
- multiple scheduled exams
- non-SCHEDULED Exam Instances excluded
- baseline readiness PASS
- baseline readiness blocker
- room/proctor readiness ready
- room/proctor readiness not applicable
- room/proctor readiness blocker
- unavailable/fail-closed behavior
- zero mutation
- disposable DB cleanup

Frontend:
- typecheck
- focused tests
- relevant regression
- production build
- rendered desktop/mobile QA for required states

## OWNER DECISION REQUIRED:
NO, provided implementation stays inside this frozen boundary.

## STOP CONDITIONS:
STOP before scope expansion if implementation would require:
- final authentication/security policy decision
- Permission Matrix decision
- PB closure
- new role semantics
- new Teacher-vs-Proctor authority semantics
- unsupported display semantics
- schema/migration
- new dependency
- write/mutation
- completion-rate semantics
- polling/WebSocket
- architecture supersession
- Owner-level security/privacy decision

## STAGE-1 REGISTRATION PROCESS TRUTH:
- **INITIAL EXECUTION INTERRUPTION:** ANTIGRAVITY HIGH-TRAFFIC SERVICE ERROR / NO COMMIT / NO PUSH / VALID PARTIAL WORK PRESERVED.
- **INITIAL CONTROLLER PHYSICAL AUDIT:** FAIL.
- **ADDITIONAL CANONICAL-INTEGRITY FINDING:** DOCUMENT_MANIFEST v1.0.453 omitted the BU-087 specification row during the initial registration commit.
- **AUDIT FINDINGS:** resumed Stage-1 execution used manage_task despite foreground-only prohibition; one background process remained visible after completion claim; external report prematurely claimed Stage-1 PASS and omitted required process/evidence truth.
- **PROCESS DEVIATION:** YES.
- **PROCESS DEVIATION CLASSIFICATION:** NON-MATERIAL EXECUTION-CONTROL DEFECT.
- **PHYSICAL EFFECT:** NO repository spill; registration commit contains exactly six authorized documentation paths; post-commit working tree clean; staged 0; untracked 0; old_handoff.md and temp_current.md absent.
- **BACKGROUND PROCESS CLEANUP:** PASS / OWNER CONFIRMED ZERO REMAIN.
- **POST-COMMIT LOCAL AUDIT:** PASS.
- **TARGETED PROCESS-TRUTH FORWARD CORRECTION:** COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PENDING.
- **STAGE-1:** NOT YET CONTROLLER-PASSED / PHYSICAL RE-AUDIT PENDING.
- **STAGE-2:** NOT AUTHORIZED / PENDING CONTROLLER PHYSICAL RE-AUDIT.
