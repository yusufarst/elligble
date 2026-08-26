# BU-010: Secure Assessment Idempotent Submission Runtime Bootstrap

**Build Unit:** BU-010
**Status:** IMPLEMENTATION EXECUTED / CLOSURE STATE-SYNC PENDING CONTROLLER AUDIT
**Phase:** BUILD
**Registration Controller Audit:** PASS
**Registration Owner Acceptance:** COMPLETE
**Registration Git Finalization:** COMPLETE
**Registration Commit:** f57d1af5fdf48a568f1cb77ae1ad162a7233e5d2
**Registration Repository Finalized:** YES
**Readiness Assessment:** PASS
**Readiness Controller Audit:** PASS
**Readiness Owner Acceptance:** COMPLETE
**Readiness Git Finalization:** COMPLETE
**Readiness Git Finalization Commit:** 310edcf2e7d1b3c5e6aa800c5efa28f061000458
**Readiness Repository Finalized:** YES
**Post-Readiness Lifecycle Sync:** COMPLETE
**Post-Readiness Lifecycle Sync Controller Audit:** PASS
**Post-Readiness Lifecycle Sync Git Finalization:** COMPLETE
**Post-Readiness Lifecycle Sync Commit:** 7af4cb8b3b74756397d97b9f22d8126040380e1b
**Post-Readiness Lifecycle Sync Git Finalization Commit Parent:** 310edcf2e7d1b3c5e6aa800c5efa28f061000458
**Post-Readiness Lifecycle Sync Git Finalization Commit Subject:** docs(build): sync BU-010 post-readiness lifecycle
**Post-Readiness Lifecycle Sync Repository Finalized:** YES
**Implementation Activation:** COMPLETE
**Implementation:** EXECUTED
**Typecheck:** PASS
**Test:** PASS
**Final Local Tests:** 104 / 104 PASS
**Terminal Verification:** PASS
**Real PostgreSQL Verification:** PASS
**Fresh First-Write Concurrency:** PASS
**Predecessor Regression:** PASS
**Implementation Controller Audit:** PASS
**Terminal Verification Controller Audit:** PASS
**Implementation Owner Acceptance:** COMPLETE
**Implementation Git Finalization:** COMPLETE
**Implementation Git Finalization Commit:** 9703042682cd01aeaed9a1f499cf85107c742b91
**Implementation Git Finalization Commit Subject:** feat(secure-assessment): implement BU-010 submission runtime
**Forward Whitespace Correction:** COMPLETE
**Forward Whitespace Correction Commit:** 098a3049d08dbbb2613b2e6076ee374816824db7
**Forward Whitespace Correction Commit Subject:** fix(secure-assessment): clean BU-010 whitespace
**Implementation Repository Finalized:** YES
**Closure / State-Sync Package:** AUTHORED / PENDING CONTROLLER AUDIT
**Closure Package Controller Audit:** NOT YET
**Closure Package Owner Acceptance:** NOT YET
**Closure State-Sync Git Finalization:** NOT YET
**Closure State-Sync Repository Finalized:** NO
**Done:** NO
**Full BU-010 Repository Finalized:** NO
**PB06:** OPEN
**PB07:** OPEN

## READINESS DECISIONS

SCHEMA CHANGE REQUIRED:
NO

--------------------------------------------------
1. LOCAL RUNTIME INTEGRATION BOUNDARY
--------------------------------------------------

Use the physically observed Secure Assessment convention:
- node:http handler
- pg Pool / PoolClient
- createServer dependency injection
- AuthorizedAssessmentContext

This is a BU-010 local bounded implementation decision only.
It is NOT a global platform stack or API decision.

--------------------------------------------------
2. AUTHORIZED CONTEXT
--------------------------------------------------

Use existing physical:
AuthorizedAssessmentContext {
    tenantId: string;
    authorizedAttemptId: string;
}

Required:
- tenant authority comes from trusted context.tenantId.
- Attempt request identity must equal: context.authorizedAttemptId.
- Do NOT accept tenant authority from request body/query.
- Missing trusted context: 403 forbidden.
- Attempt mismatch: 403 forbidden.

Do NOT claim full authentication is complete.

--------------------------------------------------
3. IMPLEMENTATION FILE CANDIDATES
--------------------------------------------------

Based on physical runtime structure, resolve exact future paths.
Audit at minimum:
- runtime/secure-assessment/src/submission.ts
- runtime/secure-assessment/src/server.ts
- runtime/secure-assessment/test/submission.test.ts
- runtime/secure-assessment/test/server.test.ts
- runtime/secure-assessment/package.json

Include package.json because the physical normal test script explicitly enumerates test files and therefore requires registration of submission.test.ts.

--------------------------------------------------
4. LOCAL POST SUBMISSION CONTRACT
--------------------------------------------------

BU-010 LOCAL BOUNDED RUNTIME CONTRACT

Exact bounded POST route consistent with physical runtime precedent:
POST /api/v1/assessment/submit

NOT a platform-wide API contract.

Request may contain only the bounded Attempt identity required by the selected contract.
- No tenant authority.
- No client submitted_at.
- No client idempotency key.

--------------------------------------------------
5. SUBMITTED-STATE READBACK CONTRACT
--------------------------------------------------

BU-010 LOCAL BOUNDED RUNTIME CONTRACT

NOT a platform-wide API contract.

GET /api/v1/assessment/submission?attemptId=<uuid>

It must use authorized tenant + Attempt context.

AUTHORIZED EXISTING ATTEMPT + NO SUBMISSION ROW:

HTTP 200 OK

{
  "status": "not_submitted"
}

Meaning:

- the authorized Exam Attempt exists;
- no authoritative accepted final Submission row currently exists.

`not_submitted` is response metadata only.

It MUST NOT create:

- a mutable Submission status column;
- a general Exam Attempt lifecycle/status state machine.

AUTHORIZED EXISTING ATTEMPT + AUTHORITATIVE SUBMISSION ROW:

HTTP 200 OK

{
  "status": "submitted",
  "submissionId": "<authoritative persisted UUID>",
  "submittedAt": "<authoritative persisted timestamp>"
}

Required:

submissionId derives from:
secure_assessment_exam_submissions.id

submittedAt derives from:
secure_assessment_exam_submissions.submitted_at

--------------------------------------------------
6. FIRST SUBMISSION ALGORITHM
--------------------------------------------------

Define exact sequence:
1. method validation;
2. request/UUID validation;
3. trusted authorized context acquisition;
4. attemptId == authorizedAttemptId validation;
5. pg Pool connection;
6. tenant-safe Attempt existence validation;
7. transaction if required by selected bounded flow;
8. insert into secure_assessment_exam_submissions using:
   tenant_id from trusted context;
   exam_attempt_id from authorized Attempt;
9. allow database to generate:
   id
   submitted_at;
10. return authoritative persisted row;
11. bounded commit/rollback behavior.

Client may NOT provide authoritative:
id, submitted_at, tenant_id, idempotency key.

--------------------------------------------------
7. DUPLICATE / RETRY CONVERGENCE
--------------------------------------------------

Logical identity: tenant_id + exam_attempt_id.

Do NOT require a separate pre-check to determine idempotency correctness.

Define INITIAL / REPEATED only as bounded outcome classification.
Required algorithm must remain safe under concurrency.
Same tenant + Attempt retry returns:
- same authoritative submissionId
- same authoritative submittedAt.

No second row.
No replacement.

--------------------------------------------------
8. CONCURRENCY / UNIQUE-RACE ALGORITHM
--------------------------------------------------

Use BU-009 database uniqueness as final protection.

If consistent with physically observed answer-runtime convention, select:
INSERT ... ON CONFLICT DO NOTHING RETURNING id, submitted_at

Then:
if INSERT returns row:
  classify bounded outcome as initial;
  return that authoritative row.

if INSERT returns no row:
  authoritatively re-read:
  secure_assessment_exam_submissions
  by:
  tenant_id
  exam_attempt_id
  and return the existing row.

Concurrent duplicate callers must converge to:
- one database row
- one submissionId
- one submittedAt.

Do NOT add distributed locking.
Do NOT turn uniqueness collision into a conflicting-final error.

--------------------------------------------------
9. AUTHORITATIVE RECEIPT
--------------------------------------------------

Define exact bounded receipt:
{
  "status": "submitted",
  "submissionId": "<authoritative persisted UUID>",
  "submittedAt": "<authoritative persisted timestamp>"
}

status is response metadata only.
It must NOT become a new mutable Submission status column/state machine.

--------------------------------------------------
10. FAILURE / RESPONSE SEMANTICS
--------------------------------------------------

Use existing bounded runtime convention where applicable.

Define exactly:

invalid/missing attemptId UUID:

HTTP 400
{
  "error": "invalid_request"
}

missing trusted AuthorizedAssessmentContext:

HTTP 403
{
  "error": "forbidden"
}

attemptId != context.authorizedAttemptId:

HTTP 403
{
  "error": "forbidden"
}

nonexistent or inaccessible Attempt in authorized tenant context:

HTTP 404
{
  "error": "assessment_context_not_found"
}

persistence unavailable:

HTTP 503
{
  "error": "persistence_unavailable"
}

unexpected bounded failure:

HTTP 500
{
  "error": "internal_error"
}

unsupported method at the bounded handler:

HTTP 405
{
  "error": "method_not_allowed"
}

No database internals may leak.

Tenant authority MUST continue to come from:

context.tenantId

not query parameters.

--------------------------------------------------
11. TIMER BOUNDARY
--------------------------------------------------

Preserve:
Submission follows Timer Authority.

But BU-010 does NOT implement:
- timer-expiry enforcement
- expiry transition
- auto-submit
- answer flush at expiry
- grace period
- pause/resume policy
- new timer policy.

--------------------------------------------------
12. ZERO-LOST-ANSWER BOUNDARY
--------------------------------------------------

Submission success is NOT proof of full Zero Lost Answers.

Do NOT add:
- pending-answer flush
- reconnect reconciliation
- resume reconciliation.

PB07 remains OPEN.

--------------------------------------------------
13. COMPLETE VERIFICATION MATRIX
--------------------------------------------------

Future BU-010 implementation verification MUST prove all:
1. first submission succeeds;
2. exactly one authoritative Submission row exists;
3. returned submissionId equals persisted id;
4. returned submittedAt equals persisted submitted_at;
5. database/server time is authoritative;
6. client cannot set submitted_at;
7. retry returns same submissionId;
8. retry returns same submittedAt;
9. repeated sequential retries create no extra row;
10. concurrent duplicate calls converge to exactly one row;
11. concurrent callers receive the same authoritative receipt;
12. different Attempts may submit independently;
13. invalid Attempt UUID creates no Submission;
14. malformed JSON creates no Submission;
15. missing trusted context creates no Submission;
16. Attempt mismatch creates no Submission;
17. cross-tenant/inaccessible Attempt creates no Submission;
18. nonexistent Attempt creates no Submission;
19. authorized existing Attempt with no authoritative Submission -> HTTP 200 {"status": "not_submitted"};
20. authorized existing Attempt with one authoritative Submission -> HTTP 200 {"status": "submitted", "submissionId": "<persisted id>", "submittedAt": "<persisted submitted_at>"};
21. no client idempotency key is required;
22. unsupported method returns bounded method behavior;
23. persistence unavailability returns bounded error;
24. unexpected failure does not leak database details;
25. timer expiry enforcement is absent;
26. auto-submit is absent;
27. no post-Submission Answer Save freeze is introduced by BU-010;
28. BU-009 persistence verification remains PASS;
29. relevant BU-006 answer runtime regression remains PASS;
30. relevant BU-008 timer runtime regression remains PASS;
31. normal Secure Assessment test command includes BU-010 tests;
32. tenant + Attempt query/data-access path is verified as realistic;
33. PB06 remains OPEN;
34. PB07 remains OPEN.

--------------------------------------------------
14. PREDECESSOR REGRESSION GATE
--------------------------------------------------

Using physical repository paths/test script, explicitly name the future regression gate:
- BU-009 PERSISTENCE VERIFICATION: database/verification/verify_bu009_secure_assessment_idempotent_submission_core_state.sql
- BU-006 ANSWER RUNTIME REGRESSION: runtime/secure-assessment/test/answer.test.ts
- BU-008 TIMER RUNTIME REGRESSION: runtime/secure-assessment/test/timer.test.ts
- SERVER ROUTING REGRESSION: runtime/secure-assessment/test/server.test.ts
- NORMAL SECURE ASSESSMENT TEST COMMAND: from runtime/secure-assessment run `npm test`

## PURPOSE

Establish the smallest bounded runtime behavior needed to consume the authoritative submission persistence foundation created by BU-009 while preserving canonical Idempotent Submission invariants.

This specification records the registered Build Unit boundary. Registration does NOT authorize implementation.

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
