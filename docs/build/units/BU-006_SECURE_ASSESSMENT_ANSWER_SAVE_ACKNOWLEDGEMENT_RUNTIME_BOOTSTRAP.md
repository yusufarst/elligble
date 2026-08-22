# BU-006: Secure Assessment Answer Save / Acknowledgement Runtime Bootstrap

Lifecycle state:

Build Unit:
BU-006

Title:
Secure Assessment Answer Save / Acknowledgement Runtime Bootstrap

Status:
REGISTERED / NOT STARTED

Phase:
BUILD

Registration Controller Audit:
NOT YET

Registration Owner Acceptance:
NOT YET

Registration Git Finalization:
NOT COMPLETE

Registration Repository Finalized:
NO

Implementation Readiness / Activation:
NOT EXECUTED

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

NEW SCHEMA REQUIRED:
NOT YET ESTABLISHED

Readiness must inspect actual BU-004 physical schema first.

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

EXACT IDEMPOTENCY MECHANISM:
DEFER TO READINESS

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

DONE:
NO
