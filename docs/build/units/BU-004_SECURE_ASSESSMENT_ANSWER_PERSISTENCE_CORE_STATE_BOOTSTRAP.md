# BU-004: Secure Assessment Answer Persistence Core State Bootstrap

Lifecycle state:

Build Unit:
BU-004

Status:
REGISTERED / NOT STARTED

Phase:
BUILD

Implementation:
NOT EXECUTED

Registration Owner Acceptance:
NOT YET

Registration Git Finalization:
NOT COMPLETE

Registration Repository Finalized:
NO

Implementation Repository Finalized:
NO

Done:
NO

PURPOSE:

Establish ONLY the minimum persistence foundation for authoritative Secure Assessment answer state.

EXACT IN-SCOPE:

- authoritative persisted answer state associated with a valid Exam Attempt;
- stable association between persisted answer state and the applicable immutable Exam Question Snapshot;
- tenant-safe assessment-context association;
- persistence-level foundation necessary to represent that an answer write has reached authoritative server state;
- baseline acknowledgement/version/write identity semantics only where required to preserve server-acknowledged vs unacknowledged distinction;
- structural groundwork for later Zero-Lost-Answer runtime.

Physical representation is not prescribed here unless a later bounded implementation decision explicitly allows it.

EXACT OUT-OF-SCOPE:

- client autosave implementation;
- browser/local recovery buffer;
- IndexedDB/localStorage technology selection;
- network retry runtime;
- reconnect/resume reconciliation runtime;
- Zero-Lost-Answer end-to-end runtime claim;
- server-authoritative timer;
- timer adjustment policy/runtime;
- submission;
- Submission Receipt;
- idempotent final submission;
- scoring;
- result finalization;
- Exam Room;
- proctoring;
- Violation Event persistence;
- Risk Signal persistence;
- Incident;
- Cheating Decision;
- anti-cheating heuristics;
- APIs;
- frontend;
- backend framework/runtime initialization;
- authentication implementation;
- permission matrix implementation;
- message broker/event bus;
- deployment;
- production hosting;
- PB closure;
- BU-005+.

==================================================
UPSTREAM AUTHORITIES & CANONICAL INVARIANTS
==================================================

1. Secure Assessment is still the highest implementation priority.
2. BU-002 established Exam Instance / Participant / Attempt / Session persistence.
3. BU-003 established Question Bank Item and immutable/governed Exam Question Snapshot.
4. Locked Secure Assessment Architecture defines Answer Persistence as an active-exam MUST-HAVE dependency.
5. Answer continuity requires authoritative answer state.
6. Server acknowledgement must distinguish a successfully accepted answer write from merely pending/unconfirmed client state.
7. Answer state must bind to the valid Exam Attempt and stable Exam Question Snapshot.
8. Therefore a bounded Answer Persistence foundation is the next dependency before later reconnect/timer/submission/runtime capability.

Preserve:

- CLIENT/PENDING ANSWER STATE != SERVER-ACKNOWLEDGED AUTHORITATIVE ANSWER STATE
- Exam Session loss must not inherently imply answer loss.
- Exam Attempt remains distinct from Exam Session.
- Question Bank Item != immutable Exam Question Snapshot.

OWNERSHIP/TENANCY BOUNDARY:
Ensure tenant-safe assessment-context association and isolation boundaries appropriate for answer state.

==================================================
TECHNOLOGY MATURITY
==================================================

GLOBAL FK/EVENT STRATEGY:
PROVISIONAL

GLOBAL FINAL TECHNOLOGY STACK:
NOT GLOBALLY SELECTED

POSTGRESQL 18 GLOBAL SELECTION:
NO

INSFORGE:
NOT GLOBALLY SELECTED OR REJECTED IN REGISTRATION

AGENT SKILLS / TOOLING:
NOT GLOBALLY SELECTED OR INSTALLED

The later BU-004 implementation may reuse the already verified bounded persistence foundation only if justified at its implementation readiness gate.

==================================================
QUERY / PERFORMANCE / DATA-ACCESS GATE
==================================================

QUERY/PERFORMANCE GATE:
RELEVANT

Future implementation verification must require, where applicable:

- bounded Attempt-scoped answer retrieval;
- bounded Attempt + Snapshot answer lookup;
- appropriate tenant/attempt/snapshot access paths;
- indexes/composite indexes derived from actual query shapes;
- relationship/FK-side indexing where materially required;
- no inappropriate full-table scans;
- no N+1 query pattern once application access exists;
- bounded SELECTs;
- pagination only where collections can materially grow;
- narrow transactions for answer writes;
- EXPLAIN / EXPLAIN ANALYZE for critical persisted-answer queries;
- realistic-volume performance fixtures;
- query count / latency evidence where meaningful;
- no arbitrary forced planner settings solely to make an index appear;
- future observability hooks where runtime scope later permits them.

Do not invent unsupported performance thresholds.

==================================================
VERIFICATION / DONE EXPECTATIONS
==================================================

Future implementation verification must cover:

- exact bounded schema matching in-scope capabilities;
- distinction between acknowledged and unacknowledged states;
- query/access-plan verification;
- no out-of-scope expansion;
- migration verification;
- terminal verification.

Future DONE requires:

- bounded implementation complete;
- migration success;
- structural/invariant verification PASS;
- query/performance verification PASS;
- regression checks PASS;
- terminal verification PASS;
- Controller audit PASS;
- Owner Acceptance where applicable;
- controlled Git finalization;
- repository finalized;
- state synchronization where materially required.

Explicitly: This registration creates NO implementation.

==================================================
PB RELATIONSHIP
==================================================

PB:
12 OPEN / 0 RESOLVED

PB-07 (Zero-Lost-Answer):
OPEN. No claim that PB-07 Zero-Lost-Answer Verification is closed.
