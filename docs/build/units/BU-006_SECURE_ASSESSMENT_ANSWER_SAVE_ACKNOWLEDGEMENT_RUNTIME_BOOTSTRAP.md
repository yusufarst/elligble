# BU-006: Secure Assessment Answer Save / Acknowledgement Runtime Bootstrap

Lifecycle state:

Build Unit:
BU-006

Title:
Secure Assessment Answer Save / Acknowledgement Runtime Bootstrap

Status:
REGISTERED / READINESS OWNER-ACCEPTED / IMPLEMENTATION NOT STARTED

Phase:
BUILD

Registration Controller Audit:
PASS

Registration Owner Acceptance:
COMPLETE

Registration Git Finalization:
COMPLETE

Registration Repository Finalized:
YES

Registration Commit:
5ac38c73d60003af1a9420664ed791a62ad37736

REGISTRATION COMMIT PARENT:
898c87c87504d5fcb148993988792f56dd31d8fa

REGISTRATION COMMIT SUBJECT:
docs(build): register BU-006 answer save acknowledgement runtime

Implementation Readiness / Activation:
PASS

Readiness Controller Audit:
PASS

Readiness Owner Acceptance:
COMPLETE

Readiness Git Finalization:
NOT COMPLETE

Readiness Repository Finalized:
NO

Implementation:
NOT EXECUTED

Terminal Verification:
NOT EXECUTED

Query / Performance / Data-Access Verification:
NOT EXECUTED

Implementation Owner Acceptance:
NOT YET

Implementation Repository Finalized:
NO

Done:
NO

==================================================
1. PURPOSE
==================================================

BU-006 establishes ONLY the bounded server-side Secure Assessment Answer
Save / authoritative Acknowledgement runtime capability.

It receives a bounded answer-save request, validates applicable tenant /
Exam Attempt / immutable Exam Question Snapshot context, writes authoritative
Answer state through the existing persistence foundation, and acknowledges
the save only after authoritative acceptance.

ANSWER STATE OWNER:
Exam Attempt

Exam Session may be relevant runtime context but MUST NOT become the owner of
Answer state.

This unit ADVANCES Answer Continuity.

This unit DOES NOT complete the end-to-end Zero-Lost-Answer runtime.

==================================================
2. EXACT IN-SCOPE
==================================================

- bounded server-side answer-save API capability hosted by the existing BU-005
  runtime;
- tenant-safe Secure Assessment context;
- valid Exam Attempt association;
- valid immutable Exam Question Snapshot association;
- Answer state remains Attempt-owned, not Session-owned;
- reuse of BU-004 authoritative Answer persistence where physically sufficient;
- safe authoritative Answer write;
- answer-save retry/idempotency semantic convergence;
- no duplicate/inconsistent authoritative state from repeated logical saves;
- server acknowledgement only after authoritative acceptance;
- explicit failure/non-acknowledgement where authoritative acceptance fails;
- bounded runtime logging/error evidence;
- narrow transaction boundary;
- actual query/data-access/performance verification;
- predecessor regression protection.

Exact route, method, request/response payload, status semantics,
single-answer-vs-bounded-batch boundary, concurrency behavior, and
idempotency/convergence mechanism remain readiness decisions unless already
LOCKED by repository authority.

==================================================
3. EXACT OUT-OF-SCOPE
==================================================

- client-side autosave scheduler;
- client response-state implementation;
- durable local recovery buffer;
- IndexedDB/localStorage decision;
- local sync queue;
- offline-first orchestration;
- network retry orchestration;
- reconnect/resume/reconciliation;
- device-transfer recovery;
- full Zero-Lost-Answer end-to-end runtime;
- PB-07 closure;
- Server-Authoritative Timer;
- final submission;
- idempotent final submission;
- Submission Receipt;
- final submission flush semantics;
- scoring;
- result finalization;
- Exam Room;
- proctoring;
- Violation Event;
- Risk Signal;
- Incident;
- Cheating Decision;
- cheating-verdict logic;
- frontend/mobile implementation;
- full authentication implementation;
- Permission Matrix implementation;
- broker/cache/general event bus;
- deployment/hosting;
- global technology selection;
- Production Blocker closure;
- unrelated domain work.

Schema/migration changes are NOT automatically in-scope.

REGISTRATION-ERA NEW SCHEMA DECISION:
DEFERRED TO IMPLEMENTATION READINESS

CURRENT READINESS SCHEMA ASSESSMENT:
BU-004 PHYSICAL SCHEMA SUFFICIENT / CONTROLLER AUDIT PASS /
OWNER ACCEPTANCE COMPLETE

NEW SCHEMA REQUIRED:
NO

SCHEMA / MIGRATION CHANGE:
NOT REQUIRED BY CURRENT READINESS CANDIDATE

If existing schema is sufficient:
no migration is required.

If a material schema deficiency is found:
STOP and require Controller-approved scope clarification before schema mutation.

==================================================
4. CANONICAL SEMANTICS
==================================================

ZERO LOST ANSWERS

CLIENT/PENDING ANSWER STATE !=
SERVER-ACKNOWLEDGED AUTHORITATIVE ANSWER STATE

ANSWER SAVE IDEMPOTENCY !=
IDEMPOTENT FINAL SUBMISSION

RECONNECT != RETAKE

Student != Exam Participant != Exam Attempt != Exam Session

Assessment Type != Exam Instance

Question Bank Item != immutable Exam Question Snapshot

Teacher != Proctor

Violation Event != Risk Signal != Incident != Cheating Decision

Risk Signal != cheating verdict

network/IP/location/device/reconnect context != cheating proof

Exam Session loss must not inherently imply Answer loss.

ANSWER STATE OWNER:
Exam Attempt

SERVER ACKNOWLEDGEMENT:
means the corresponding authoritative Answer write has been accepted.

PENDING / UNACKNOWLEDGED STATE:
must not be represented as server-saved.

FAILURE BEFORE ACKNOWLEDGEMENT:
must not be represented as proof of authoritative save.

ANSWER-SAVE RETRY:
must converge without duplicate/inconsistent authoritative Answer state.

MANDATORY DUPLICATE HTTP REJECTION:
NO

REGISTRATION-ERA IDEMPOTENCY MECHANISM DECISION:
DEFERRED TO IMPLEMENTATION READINESS

CURRENT READINESS IDEMPOTENCY / CONVERGENCE MECHANISM:
DEFINED IN SECTION 12 / CONTROLLER AUDIT PASS /
OWNER ACCEPTANCE COMPLETE

IDEMPOTENT FINAL SUBMISSION:
NOT IMPLEMENTED BY BU-006

==================================================
5. PREDECESSORS
==================================================

BU-002:
Exam Attempt/core-state dependency

BU-003:
immutable Exam Question Snapshot dependency where applicable

BU-004:
authoritative Answer persistence foundation

BU-005:
bounded Secure Assessment runtime + pg/data-access foundation

Do not reopen predecessors.

==================================================
6. TECHNOLOGY MATURITY
==================================================

EXISTING BU-005 BOUNDED RUNTIME:
REUSABLE

BU-005 BOUNDED LOCAL RUNTIME:
Node.js 24.x + TypeScript + node:http + pg

GLOBAL FK/EVENT STRATEGY:
PROVISIONAL

GLOBAL FINAL TECHNOLOGY STACK:
NOT GLOBALLY SELECTED

POSTGRESQL 18 GLOBAL SELECTION:
NO

NEW GLOBAL TECHNOLOGY DECISION REQUIRED:
NO

==================================================
7. MANDATORY FUTURE READINESS GATE
==================================================

Before implementation, readiness must determine:

- BU-004 physical schema sufficiency;
- whether any schema change is necessary;
- exact endpoint route;
- exact method;
- request payload;
- acknowledgement/error response payload;
- status semantics;
- single-answer vs bounded-batch boundary;
- tenant / Attempt / Snapshot context inputs;
- inherited authorization/context boundary;
- concurrency behavior;
- idempotency/convergence mechanism;
- authoritative update/write semantics;
- transaction boundary;
- database failure behavior;
- acknowledgement-after-acceptance rule;
- actual query/data-access path;
- index sufficiency;
- realistic verification method;
- exact source-write boundary;
- regression scope.

Registration MUST NOT decide those prematurely.

==================================================
8. QUERY / PERFORMANCE / DATA-ACCESS GATE
==================================================

QUERY / PERFORMANCE / DATA-ACCESS GATE:
RELEVANT

Future verification must inspect actual executable paths including:

- tenant + Exam Attempt scoped Answer write;
- Attempt + immutable Exam Question Snapshot lookup;
- bounded projections/predicates;
- index sufficiency based on actual predicates;
- narrow transaction behavior;
- duplicate/retry convergence;
- authoritative acknowledgement outcome;
- no N+1 access pattern;
- no inappropriate unbounded table access;
- bounded pg pool use;
- realistic database behavior;
- EXPLAIN / EXPLAIN ANALYZE where meaningful;
- no artificial planner forcing;
- no unsupported arbitrary latency SLO.

==================================================
9. FUTURE VERIFICATION EXPECTATIONS
==================================================

Future implementation evidence must eventually prove:

- valid tenant/Attempt/Snapshot answer save succeeds;
- clientWriteIdentity length 255 is accepted when all other request/context fields are valid;
- clientWriteIdentity length 256 is rejected as 400 invalid_request (with NO Answer mutation, NO write_version change, NO acknowledgement);
- expectedWriteVersion = 2147483647 is syntactically accepted as an in-range version value; ordinary stale/current semantics then apply;
- expectedWriteVersion > 2147483647 is rejected as 400 invalid_request (with NO Answer mutation, NO acknowledgement);
- expectedWriteVersion zero, negative, or fractional is rejected as 400 invalid_request;
- invalid tenant association fails safely;
- invalid Attempt association fails safely;
- invalid Snapshot association fails safely;
- authoritative Answer state uses expected persistence path;
- server acknowledgement follows authoritative acceptance;
- write/database failure does not emit false acknowledgement;
- repeated logical save does not create duplicate/inconsistent authoritative state;
- legitimate later Answer change follows readiness-defined semantics;
- Answer ownership stays Attempt-owned;
- no reconnect/resume completion claim;
- no final-submission completion claim;
- no full Zero-Lost-Answer completion claim;
- predecessor regressions pass;
- query/performance/data-access gate passes;
- terminal verification passes;
- implementation identities are captured before future Owner Acceptance.

==================================================
10. PB RELATIONSHIP
==================================================

PB:
12 OPEN / 0 RESOLVED

PB-06 — Assessment Capability Testing:
OPEN

BU-006 RELATIONSHIP TO PB-06:
ADVANCES an applicable testable Secure Assessment capability when implemented
and verified; registration does not close PB-06.

PB-07 — Zero-Lost-Answer Verification:
OPEN

BU-006 RELATIONSHIP TO PB-07:
ADVANCES the authoritative server-save/acknowledgement primitive but does not
provide client buffer/sync/reconnect/end-to-end verification and does not close
PB-07.

==================================================
11. FUTURE DONE CRITERIA
==================================================

Future DONE requires at minimum:

- registration Controller audit PASS;
- Registration Owner Acceptance COMPLETE;
- registration Git finalization COMPLETE;
- registration repository finalized;
- mandatory readiness/activation PASS;
- required readiness acceptance/finalization;
- bounded implementation complete;
- query/performance/data-access verification PASS;
- terminal/regression verification PASS;
- Controller implementation audit PASS;
- Implementation Owner Acceptance COMPLETE;
- controlled implementation Git finalization;
- implementation repository finalized;
- required closure/state synchronization finalized.

==================================================
12. IMPLEMENTATION READINESS / ACTIVATION PACKAGE
==================================================

BU-004 PHYSICAL SCHEMA SUFFICIENCY:
SUFFICIENT

SCHEMA CHANGE REQUIRED:
NO

EXACT ENDPOINT ROUTE:
POST /api/v1/assessment/answer/save

EXACT METHOD:
POST

REQUEST PAYLOAD:
{
  "attemptId": "uuid",
  "snapshotId": "uuid",
  "answerPayload": <non-null valid JSON value>,
  "clientWriteIdentity": "string length 1 through 255 characters inclusive",
  "expectedWriteVersion": <null for initial logical write OR integer from 1 through 2147483647 inclusive>
}

Validation:
- malformed JSON => 400 invalid_request
- invalid UUID/null answerPayload => 400 invalid_request
- clientWriteIdentity length 0 => 400 invalid_request
- clientWriteIdentity length > 255 => 400 invalid_request
- expectedWriteVersion 0 => 400 invalid_request
- expectedWriteVersion negative => 400 invalid_request
- expectedWriteVersion non-integer => 400 invalid_request
- expectedWriteVersion > 2147483647 => 400 invalid_request
- No database write attempted for invalid length or version. No acknowledgement.
- Trusted tenant context is inherited, not parsed from JSON authority.

ACKNOWLEDGEMENT RESPONSE PAYLOAD:
{
  "status": "acknowledged",
  "clientWriteIdentity": "<accepted logical identity>",
  "writeVersion": <authoritative integer>
}

ERROR RESPONSE SEMANTICS:
- Malformed input => 400 invalid_request
- Missing or denied trusted authorization context => 403 forbidden
- Authorized context but referenced Attempt/Snapshot does not exist => 404 assessment_context_not_found
- Attempt/Snapshot incompatible context => 409 assessment_context_conflict
- Same clientWriteIdentity with different payload => 409 write_identity_reuse_conflict
- Different logical write with stale expectedWriteVersion => 409 stale_write_version
- Database unavailable/dependency failure => 503 persistence_unavailable
- Unexpected bounded internal failure => 500 internal_error

Never emit acknowledged status for any failure/conflict. Do not leak database details, constraint names, credentials, or internal stack.

SINGLE-ANSWER VS BOUNDED-BATCH BOUNDARY:
Single-answer only per request.

TENANT CONTEXT:
Comes from trusted AuthorizedAssessmentContext supplied through the inherited
fail-closed authorization/security dependency seam.

Tenant authority MUST NOT be established from request JSON.

ATTEMPT / SNAPSHOT INPUTS:
attemptId and snapshotId come from the validated request payload.

DATABASE CONTEXT CHECKS:
Validate tenant-safe Attempt/Snapshot/data-context relationships only.
They do NOT authorize the caller.

INHERITED AUTHORIZATION/CONTEXT BOUNDARY:
- database FK/existence/context checks validate DATA CONTEXT only;
- they do NOT authorize the caller;
- tenant authority MUST NOT be established merely by tenantId supplied in request JSON;
- full Authentication implementation remains OUT OF SCOPE;
- BU-006 must consume a TRUSTED inherited authorization/security context through a fail-closed dependency seam;
- missing/denied trusted authorization context => request denied;
- Secure Assessment does not re-own Identity/Tenant authorization truth.

AuthorizedAssessmentContext:
- tenantId
- authorized Exam Attempt scope/context required by this save

HTTP handler must receive that context from an injected dependency.

CONCURRENCY BEHAVIOR:
CLIENT WRITE IDENTITY identifies one logical Answer save.
EXPECTED WRITE VERSION optimistic-concurrency token.
Concurrent first-write collision must converge through the existing unique Answer key without creating a second authoritative row. A losing concurrent create must be reclassified against authoritative state; it must not blindly overwrite it.
Delayed old retry must never overwrite a newer accepted answer merely because it arrived later.

IDEMPOTENCY / CONVERGENCE MECHANISM:
DUPLICATE SAME LOGICAL WRITE:
If current client_write_identity == incoming clientWriteIdentity AND stored answer_payload is semantically equal to incoming answerPayload:
- do NOT mutate authoritative Answer;
- do NOT increment write_version;
- return acknowledgement of the existing accepted write/version.
(This duplicate MUST NOT require HTTP rejection.)

SAME WRITE IDENTITY + DIFFERENT PAYLOAD:
- do NOT mutate;
- return 409 write_identity_reuse_conflict.

DIFFERENT WRITE IDENTITY:
May modify current Answer only when incoming expectedWriteVersion matches the current authoritative write_version.
If expectedWriteVersion is stale:
- do NOT mutate;
- return 409 stale_write_version.

LEGITIMATE LATER ANSWER CHANGE:
- new clientWriteIdentity;
- expectedWriteVersion matches authoritative current version;
- update Answer;
- increment write_version exactly once;
- acknowledgement identifies the new logical write/version.

INITIAL WRITE:
expectedWriteVersion is null.

AUTHORITATIVE UPDATE/WRITE SEMANTICS:
1. resolve authorized tenant context;
2. inspect the current Answer row for exact tenant + Attempt + Snapshot, locking/current-version guarding where required;
3. classify: initial write, duplicate same logical write, identity-reuse conflict, stale-version conflict, legitimate next write;
4. insert/update only when classification permits;
5. existing BU-004 FK/trigger/context constraints remain authoritative physical guards;
6. COMMIT successfully;
7. only after successful authoritative completion emit acknowledgement.

TRANSACTION BOUNDARY:
ACK MUST NOT be emitted before successful transaction/statement completion.

DATABASE FAILURE BEHAVIOR:
Returns 503/500 without false acknowledgement.

ACKNOWLEDGEMENT-AFTER-ACCEPTANCE RULE:
SERVER ACKNOWLEDGEMENT means the corresponding logical Answer write is known to be authoritatively accepted.
- For a duplicate of an already accepted logical write: return the already authoritative identity/version without new mutation.
- For a new accepted write: return only after authoritative database completion succeeds.
- PENDING / failed / stale / unauthorized / unknown: NOT server-saved.
(This does NOT implement client offline recovery or reconnect.)

ACTUAL QUERY / DATA-ACCESS PATH:
Implementation defined query mapping to the 7-step data-access semantics without forcing an unsafe exact SQL string.

INDEX SUFFICIENCY:
Explicit unique index `uq_sa_exam_answer_current` (tenant_id, exam_attempt_id, exam_question_snapshot_id) fully supports the classification clause.

REALISTIC VERIFICATION METHOD:
node:test integration against controlled/disposable PostgreSQL verification environment with migrations 0001-0004 applied.

EXACT SOURCE-WRITE BOUNDARY:
NEW:
runtime/secure-assessment/src/answer.ts
runtime/secure-assessment/test/answer.test.ts

MODIFY:
runtime/secure-assessment/src/server.ts
runtime/secure-assessment/src/main.ts
runtime/secure-assessment/test/server.test.ts
runtime/secure-assessment/package.json

REGRESSION SCOPE:
BU-005 healthz/readyz unimpacted.

DONE:
NO
