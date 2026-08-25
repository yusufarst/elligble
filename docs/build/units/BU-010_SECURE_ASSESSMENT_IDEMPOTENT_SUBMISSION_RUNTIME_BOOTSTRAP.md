# BU-010: Secure Assessment Idempotent Submission Runtime Bootstrap

**Build Unit:** BU-010
**Status:** REGISTRATION CANDIDATE / NOT STARTED
**Phase:** BUILD
**Registration Controller Audit:** PASS
**Registration Owner Acceptance:** COMPLETE
**Registration Git Finalization:** NOT COMPLETE
**Registration Repository Finalized:** NO
**Implementation Readiness:** NOT YET
**Implementation:** NOT EXECUTED
**Done:** NO

## PURPOSE

Establish the smallest bounded runtime behavior needed to consume the authoritative submission persistence foundation created by BU-009 while preserving canonical Idempotent Submission invariants.

This specification establishes only the registration candidate. This execution does NOT authorize implementation.

## CANONICAL RATIONALE

Secure Assessment remains the priority delivery group.

Active-exam MUST-HAVE dependencies include:
- Identity / Auth
- Assessment Core
- Answer Persistence
- Timer Authority
- Submission
- Essential Security

BU-009 completed the authoritative final Submission persistence foundation.

BU-010 advances ONLY the bounded Submission runtime required to use that foundation.

Architecture requires:
- duplicate/retry submission behavior converges on the same logical result;
- retries must not create conflicting final submissions;
- accepted final submission has unambiguous authoritative state;
- acceptance must be distinguishable from merely initiating a request;
- authoritative Submission Receipt/equivalent confirmation remains stable;
- a submitted Attempt must not silently return to active state;
- tenant, identity, authorization, and assessment context boundaries remain enforced;
- client state must not become authoritative.

## IN-SCOPE

- Bounded server-side user-initiated final Submission runtime.
- Use of BU-009 authoritative submission persistence.
- Tenant + Exam Attempt bound submission operation.
- Idempotent duplicate/retry convergence onto the already accepted logical Submission.
- Stable authoritative response/receipt for an already-accepted Submission.
- Prevention of conflicting multiple final submissions.
- Authoritative submitted-state readback required by the bounded runtime.
- Runtime/data-access verification for this exact Submission path.
- Predecessor regression for completed Secure Assessment foundations.

## EXPLICIT OUT-OF-SCOPE

- Timer-expiry detection/enforcement implementation.
- Expiry auto-submit.
- Answer flush at expiry.
- Reconnect/resume/reconciliation implementation.
- Full Zero-Lost-Answer closure.
- PB06 closure.
- PB07 closure.
- Scoring.
- Grading.
- Results publication.
- Proctoring.
- Cheating verdict.
- Advanced risk detection.
- Essential Security implementation beyond inherited authorization/security requirements necessary for the bounded Submission operation.
- Frontend/UI/mobile.
- Production deployment.
- Global technology-stack selection.
- Platform-wide API contract.
- Platform-wide ERD.
- Unrelated domains.
- Successor Build Units.

## TIMER BOUNDARY

Submission follows Timer Authority in the architecture dependency model.
However, BU-010 registration does NOT implement expiry detection, expiry transition, auto-submit, grace period, pause/continue policy, or answer flush at expiry.
If the user-initiated Submission runtime needs current timer state only to preserve an already-established invariant, that dependency is narrow. Timer policy is not invented here.

## ZERO-LOST-ANSWER BOUNDARY

PB07 remains OPEN.
BU-010 does NOT claim full Zero-Lost-Answer.
No silent implementation of reconnect reconciliation or pending-client-answer flush.
Submission success is not proof that all prior answers were safely persisted unless existing authoritative acknowledgement state proves it.

## ESSENTIAL SECURITY BOUNDARY

Essential Security remains a Secure Assessment MUST-HAVE capability.
BU-010 must preserve inherited tenant/identity/authorization/assessment-context checks.
BU-010 does NOT complete the entire Essential Security capability.
No cheating/risk verdict path is created.
Teacher != Proctor. Risk Signal != verdict.

## DEPENDENCIES

- BU-009 authoritative submission persistence foundation.
- Inherited tenant, identity, authorization, and assessment-context checks from preceding foundations.
