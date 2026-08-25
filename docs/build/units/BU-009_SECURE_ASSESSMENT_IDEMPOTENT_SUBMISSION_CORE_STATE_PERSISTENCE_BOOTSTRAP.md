# BU-009: Secure Assessment Idempotent Submission Core State Persistence Bootstrap

**Build Unit:** BU-009
**Status:** COMPLETE / TERMINAL VERIFICATION PASS / QUERY-PERFORMANCE-DATA-ACCESS VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED
**Phase:** BUILD
**Registration Controller Audit:** PASS
**Registration Owner Acceptance:** COMPLETE
**Registration Git Finalization:** COMPLETE
**Registration Commit:** 0135078e702da050515826486863796084e09c22
**Registration Repository Finalized:** YES
**Readiness Assessment:** PASS
**Implementation Readiness / Activation:** PASS
**Readiness Controller Audit:** PASS
**Readiness Owner Acceptance:** COMPLETE
**Readiness Package Physical Commit:** 721374d30c91c9c428f5f66cb84ce0d439bbe3ab
**Readiness Git Finalization:** COMPLETE
**Readiness Repository Finalized:** YES
**Readiness Git Finalization Commit:** 090a20614ac48d12ff12581cab194f3cefce28a6
**Implementation:** EXECUTED
**Terminal Verification:** PASS
**Query / Performance / Data-Access Verification:** PASS
**Predecessor Regression:** PASS
**Implementation Controller Audit:** PASS
**Implementation Owner Acceptance:** COMPLETE
**Implementation Git Finalization:** COMPLETE
**Implementation Repository Finalized:** YES
**Implementation Git Finalization Commit:** 1d59f5f07e706c846d3b11be236cf09fafd6e9f7
**Implementation Git Finalization Commit Parent:** 76b6d417f426269be77a6081eee0fea89c934714
**Implementation Git Finalization Commit Subject:** feat(database): implement BU-009 idempotent submission core state persistence
**Implementation Migration SHA256:** 7489BFC3B46A839D8405BD526ACCBF46FAC7ACEC093848025B757F90F6BCAD8E
**Implementation Verification SHA256:** 3999AB80AA784C6873FBD0F6610C8044888DF5FD0080A1B894E85C3D2542C9AD
**Closure / State-Sync Package:** COMPLETE
**Closure Package Controller Audit:** PASS
**Closure Package Owner Acceptance:** COMPLETE
**Closure State-Sync Git Finalization:** COMPLETE
**Closure State-Sync Repository Finalized:** YES
**Closure State-Sync Git Finalization Commit:** 1768f68129a0818663d29f6aead5d4b6da342502
**Done:** YES

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

## PROCESS DEFECT HISTORY

- **1. INITIAL IMPLEMENTATION AUTHORING PROCESS DEFECT:** Mandatory fresh-read evidence was incomplete. This did not reopen separately verified implementation material.
- **2. INITIAL TERMINAL / CLEANUP PROCESS DEFECTS:** Prohibited manage_task/background/process methods occurred during earlier verification/cleanup executions.
- **3. CLEANUP / RECONSTRUCTION REPORT DEFECT:** Earlier cleanup evidence included report/process inconsistencies, including manage_task reporting mismatch. Physical cleanup/material verification remained separately accepted.
- **4. RUN-104:** Material terminal/regression/query-performance result PASS, foreground/process compliance FAIL.
- **5. V16:** Initial terminal V16 failure and later exact restrict_violation correction.
- **6. INITIAL IMPLEMENTATION GIT FINALIZATION:** Correctly stopped before commit because of trailing whitespace.
- **7. WHITESPACE CORRECTION:** Whitespace-only correction changed no SQL semantics and did not require database reverification.
- **8. CLOSURE CANDIDATE HANDOFF CORRECTION:** Earlier closure candidate contained stale HANDOFF current-state claims; targeted correction removed them before Closure Controller Audit PASS.
- **9. CLOSURE PACKAGE FINALIZATION PROCESS DEFECT:** Physical commit/push PASS, but report creation used compound PowerShell despite separate-command requirements.
- **10. FINAL POST-CLOSURE AUTHORING PROCESS DEFECT:** Mandatory fresh governance/context reads were not fully demonstrated and authoring report creation used compound PowerShell. This does not reopen previously passed material gates.
- **11. CORRECTED RE-AUDIT PROCESS DEFECT:** The corrected re-audit material evidence was usable, but its external report was again created through a compound PowerShell block despite the separate-independent-command execution requirement. This process defect does not reopen any previously passed material gate.

**PRESERVED ACCEPTED PHYSICAL IDENTITIES:**
- **IMPLEMENTATION COMMIT:** `1d59f5f07e706c846d3b11be236cf09fafd6e9f7`
- **CLOSURE PACKAGE COMMIT:** `1768f68129a0818663d29f6aead5d4b6da342502`
