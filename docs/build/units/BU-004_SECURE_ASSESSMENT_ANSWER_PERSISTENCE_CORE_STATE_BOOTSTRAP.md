# BU-004: Secure Assessment Answer Persistence Core State Bootstrap

Lifecycle state:

Build Unit:
BU-004

Status:
REGISTERED / READY FOR IMPLEMENTATION

Phase:
BUILD

Implementation:
NOT EXECUTED

Registration Owner Acceptance:
COMPLETE

Registration Git Finalization:
COMPLETE

Registration Repository Finalized:
YES

Registration Git Finalization Commit:
09ca2c2978c184fb17926e7edaacd4142c83c0da

Implementation Readiness / Activation:
PASS

Readiness Owner Acceptance:
COMPLETE

Readiness Git Finalization:
COMPLETE

Readiness Repository Finalized:
YES

Readiness Git Finalization Commit:
5c6bce8f5be2c3e641daf253b45bc1cb2cddf970

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
IMPLEMENTATION READINESS / ACTIVATION
==================================================

READINESS GATE:
PASS

BOUNDED LOCAL PERSISTENCE REUSE DECISION:

BU-004 MAY reuse the existing PostgreSQL + plain SQL versioned Git migration
and verification foundation already established by BU-001/BU-002/BU-003 for
BU-004 bounded persistence implementation ONLY.

This is a bounded Build Unit local implementation choice.
This does NOT constitute:

- POSTGRESQL 18 GLOBAL SELECTION = YES
- GLOBAL FINAL TECHNOLOGY STACK = SELECTED
- global FK/event strategy resolved

EXPECTED LATER IMPLEMENTATION FILE BOUNDARY:

Migration:
database/migrations/0004_bu004_secure_assessment_answer_persistence_core_state.sql

Verification:
database/verification/verify_bu004_secure_assessment_answer_persistence_core_state.sql

Neither file has been created. Both will be created only during later
bounded implementation execution.

IMPLEMENTATION ENFORCEMENT EXPECTATIONS:

The later bounded implementation must prove:

1. answer state cannot bind across tenants;
2. answer state cannot silently bind an Attempt to a Snapshot from an
   incompatible assessment context;
3. the authoritative row/state is associated with the Attempt rather than
   being Session-owned;
4. one question's authoritative state cannot accidentally resolve to a
   different Question Bank Item truth instead of its frozen Snapshot;
5. expected uniqueness/cardinality semantics are explicitly enforced where
   required by the derived physical design;
6. malformed or invalid association cases are rejected;
7. no out-of-scope persistence concepts are introduced.

The exact physical enforcement mechanism (FK, composite FK, unique constraint,
trigger) is selected locally for BU-004 only after inspecting existing
BU-002/BU-003 schema patterns. The composite unique (id, tenant_id) pattern
established in BU-002/BU-003 provides the existing within-domain FK reference
convention. BU-004 should follow this convention where applicable.

This local enforcement choice does NOT resolve the global FK/event strategy,
which remains PROVISIONAL.

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

==================================================
QUERY / PERFORMANCE / DATA-ACCESS GATE
==================================================

QUERY/PERFORMANCE GATE:
RELEVANT

Later implementation verification must include actual critical persisted-answer
access paths:

QUERY A:
Bounded tenant + Exam Attempt scoped answer retrieval.

Example: SELECT bounded columns FROM answer_table
WHERE exam_attempt_id = $1 AND tenant_id = $2;

QUERY B:
Bounded tenant + Exam Attempt + Exam Question Snapshot lookup of a specific
authoritative answer state.

Example: SELECT bounded columns FROM answer_table
WHERE exam_attempt_id = $1 AND exam_question_snapshot_id = $2 AND tenant_id = $3;

Later verification requirements:

- indexes/composite indexes derived from real predicates;
- relationship/FK-side indexing where materially required;
- no inappropriate unbounded sequential scan on expected critical
  realistic-volume paths;
- bounded SELECT projection;
- narrow answer-write transaction boundaries;
- no N+1 access pattern once application access exists;
- EXPLAIN / EXPLAIN ANALYZE for critical executable queries;
- realistic-volume fixtures;
- query-count/latency evidence where meaningful;
- no arbitrary forced planner settings merely to produce an index plan;
- no unsupported arbitrary latency SLO.

Do not treat an index as a substitute for tenant-isolation enforcement.

==================================================
REGRESSION / TERMINAL VERIFICATION EXPECTATIONS
==================================================

Later BU-004 verification must require:

- BU-001 migration/verification regression;
- BU-002 migration/verification regression;
- BU-003 migration/verification regression;
- BU-004 migration PASS;
- BU-004 verification PASS;
- safe-repeat/idempotent migration behavior;
- structural invariant checks;
- invalid tenant/Attempt/Snapshot association rejection;
- query/performance gate PASS;
- out-of-scope persistence count/check where appropriate;
- final terminal verification;
- implementation source identities captured before Owner Acceptance.

PB-07 remains OPEN. No claim that PB-07 closes from persistence-only
verification. PB-07 requires later Zero-Lost-Answer runtime evidence.

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

==================================================
PB RELATIONSHIP
==================================================

PB:
12 OPEN / 0 RESOLVED

PB-07 (Zero-Lost-Answer):
OPEN. No claim that PB-07 Zero-Lost-Answer Verification is closed.

BU-004 is structural persistence groundwork only.
No Production Blocker closes from BU-004 alone.
