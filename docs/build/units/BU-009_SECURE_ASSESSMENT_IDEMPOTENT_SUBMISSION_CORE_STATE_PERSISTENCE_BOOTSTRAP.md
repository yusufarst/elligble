# BU-009: Secure Assessment Idempotent Submission Core State Persistence Bootstrap

**Build Unit:** BU-009
**Status:** REGISTERED / REGISTRATION REPOSITORY FINALIZED / NOT STARTED
**Phase:** BUILD
**Registration Controller Audit:** PASS
**Registration Owner Acceptance:** COMPLETE
**Registration Git Finalization:** COMPLETE
**Registration Commit:** 721374d30c91c9c428f5f66cb84ce0d439bbe3ab
**Registration Repository Finalized:** YES
**Implementation Readiness / Activation:** NOT YET
**Implementation:** NOT EXECUTED
**Done:** NO

## PURPOSE

Establish ONLY the authoritative persistence foundation required for idempotent Secure Assessment Submission core state.

Authoritative submission state must remain tenant-bound and Exam-Attempt-bound according to existing Secure Assessment ownership and state invariants.

## IN-SCOPE

- persistence foundation for authoritative final submitted Attempt state;
- persistence support required for idempotent duplicate/retry convergence;
- Submission Receipt or equivalent authoritative confirmation persistence;
- tenant-bound and Exam-Attempt-bound authoritative state;
- persistence invariants needed to prevent conflicting multiple final submissions;
- migration and persistence verification intent for the later implementation stage;
- predecessor regression requirements where appropriate.

## OUT-OF-SCOPE

- Submission HTTP/runtime execution;
- runtime request handling;
- duplicate/retry runtime convergence logic beyond persistence invariants;
- final Submission API contract implementation;
- timer expiry enforcement/detection;
- timer expiry transition;
- auto-submit;
- answer flush at expiry;
- scoring;
- proctoring;
- cheating verdicts;
- Essential Security implementation;
- frontend;
- UI;
- mobile;
- PB06 closure;
- PB07 closure;
- successor Build Units.

## CANONICAL SEMANTICS

- An accepted Submission must produce an unambiguous submitted Exam Attempt state.
- Duplicate/retry behavior for the same logical Submission must not create conflicting multiple final submissions.
- Duplicate/retry behavior must be capable of converging on the same logical result.
- Submission acceptance must be distinguishable from merely initiating a request.
- Submission Receipt or an equivalent authoritative confirmation persistence concept is within scope where required by the architecture.

## READINESS DECISIONS

AUTHORITATIVE SUBMITTED-STATE REPRESENTATION:
Use one dedicated persistence relation:
`secure_assessment_exam_submissions`
Do NOT add a general Exam Attempt lifecycle/status state machine in BU-009.
For a tenant + Exam Attempt:
- absence of a row means no authoritative accepted final Submission record.
- exactly one row means the Attempt has an authoritative accepted final Submission record.
The submission record itself is the authoritative final-submission fact.

IDEMPOTENCY / CONVERGENCE BOUNDARY:
The logical final-submission persistence identity is:
`tenant_id` + `exam_attempt_id`
Required persistence invariant: `UNIQUE (tenant_id, exam_attempt_id)`
There must never be two conflicting authoritative final Submission rows for the same tenant + Exam Attempt.
Do NOT add a client-generated idempotency key or request key in BU-009.
Later Submission runtime must make duplicate/retry requests for the same Attempt converge on the existing authoritative submission record. That runtime behavior remains OUT OF SCOPE for BU-009. BU-009 persistence verification only needs to prove the database invariant that conflicting multiple final Submission rows cannot exist.

SUBMISSION RECEIPT / AUTHORITATIVE CONFIRMATION:
Do NOT create a separate Submission Receipt table in BU-009.
The `secure_assessment_exam_submissions` row itself is the architecture-permitted equivalent authoritative confirmation.
The row's `id` is the stable authoritative Submission/Receipt identifier.
`submitted_at` is the authoritative acceptance timestamp. It MUST be database/server authoritative, not client authoritative.

EXACT CANDIDATE TABLE SHAPE:
TABLE: `secure_assessment_exam_submissions`
COLUMNS:
- `id` UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `exam_attempt_id` UUID NOT NULL
- `submitted_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

Do NOT add client timestamps, answer payload copies, answer snapshots, scores, timer values, proctoring fields, cheating fields, request payloads, client idempotency keys, generic mutable status columns, or `updated_at` solely to create mutable Submission semantics.

REQUIRED INTEGRITY:
Require tenant-safe Attempt binding:
`FOREIGN KEY (exam_attempt_id, tenant_id) REFERENCES secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT`
Require one final Submission per Attempt:
`UNIQUE (tenant_id, exam_attempt_id)`
Require tenant-scoped identity support consistent with established Secure Assessment persistence patterns:
`UNIQUE (id, tenant_id)`

Candidate names, if consistent with current convention:
- `fk_sa_submission_attempt`
- `uq_sa_submission_attempt`
- `uq_sa_submission_tenant`

QUERY / DATA-ACCESS CONTRACT:
Minimum authoritative retrieval query shape for later runtime:
`tenant_id` + `exam_attempt_id` -> zero or one authoritative Submission record.
The `UNIQUE (tenant_id, exam_attempt_id)` structure must support that bounded tenant-scoped lookup.
Tenant must never be inferred from request payload authority. No unbounded cross-tenant Submission lookup is authorized.
Readiness should define a realistic query/data-access verification gate using the repository's established persistence-performance methodology. Do not disable the natural planner merely to force an index. Do not invent an arbitrary production SLA.

MIGRATION / VERIFICATION FILE CONTRACT:
database/migrations/0006_bu009_secure_assessment_idempotent_submission_core_state.sql
database/verification/verify_bu009_secure_assessment_idempotent_submission_core_state.sql

REQUIRED FUTURE IMPLEMENTATION VERIFICATION:
- exact table presence;
- exact column names;
- exact PostgreSQL types;
- exact nullability;
- exact defaults;
- primary key presence;
- exact tenant + Attempt unique invariant;
- exact tenant-scoped id unique invariant;
- exact composite Attempt foreign key;
- ON DELETE RESTRICT;
- same-tenant valid Attempt -> Submission insert succeeds;
- cross-tenant Attempt relationship mismatch is rejected;
- second Submission for same tenant + Attempt is rejected at persistence level;
- different Attempts may each receive their own Submission;
- submitted_at is generated by authoritative database time when omitted;
- deleting an Attempt referenced by a Submission is restricted;
- required tenant + Attempt retrieval query is bounded and supported by the expected unique/index structure;
- predecessor migration/regression verification remains PASS.

Do NOT claim this persistence verification proves runtime retry response convergence.

## PREDECESSORS

BU-002:
Exam Attempt persistence foundation.

BU-004:
Secure Assessment Answer Persistence Core State Bootstrap.

BU-007:
Secure Assessment Server-Authoritative Timer Core State Persistence Bootstrap.

BU-008:
Secure Assessment Server-Authoritative Timer Start / Remaining-Time Runtime Bootstrap.

BU-001 through BU-008:
DO NOT REOPEN.

## QUERY / PERFORMANCE / DATA-ACCESS GATE

RELEVANT.

## PB-06

OPEN.

BU-009 provides persistence foundation for future Assessment Capability Testing but DOES NOT close PB-06.

## PB-07

OPEN.

BU-009 provides submission persistence but DOES NOT establish full Zero-Lost-Answer verification and DOES NOT close PB-07.

## GLOBAL FINAL TECHNOLOGY STACK

NOT GLOBALLY SELECTED.

## FUTURE DONE / LIFECYCLE COMPLETION

Future DONE requires:

- registration Controller audit PASS;
- Registration Owner Acceptance COMPLETE;
- registration Git finalization COMPLETE;
- registration repository finalized;
- mandatory implementation readiness / activation PASS;
- required readiness Owner Acceptance and Git finalization;
- bounded implementation complete;
- query / performance / data-access verification PASS;
- terminal / regression verification PASS;
- Controller implementation audit PASS;
- Implementation Owner Acceptance COMPLETE;
- controlled implementation Git finalization;
- implementation repository finalized;
- required closure / state synchronization finalized.

Registration candidate status alone does NOT make BU-009 DONE.
