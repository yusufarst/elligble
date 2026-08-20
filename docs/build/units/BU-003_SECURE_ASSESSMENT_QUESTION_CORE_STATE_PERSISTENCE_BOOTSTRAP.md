# BU-003: Secure Assessment Question Core State Persistence Bootstrap

Lifecycle state:

Build Unit:
BU-003

Status:
COMPLETE

Phase:
BUILD

Implementation:
EXECUTED

Registration Owner Acceptance:
COMPLETE

Registration Git Finalization:
COMPLETE

Registration Repository Finalized:
YES

Registration Git Finalization Commit:
6c1ecc67637a3fcff2d3515ff3883a0f9fce196b

Implementation Terminal Verification:
PASS

Implementation Query/Performance Verification:
PASS

Implementation Owner Acceptance:
COMPLETE

Implementation Repository Finalized:
YES

Implementation Git Finalization Commit:
6a5cdc74a4b91e89e94418257aebffc5152b4659

Done:
YES

PURPOSE:

Establish the persistence foundation for reusable Question Bank Items and immutable/governed Exam Question Snapshots so later answer-persistence work can bind responses to stable question truth.

EXACT IN-SCOPE:

1. Question Bank Item persistence foundation.
2. Immutable/governed Exam Question Snapshot persistence foundation.
3. Stable association between Snapshot and applicable BU-002 Exam Instance context.
4. Baseline structure required only to preserve:

Question Bank Item != Exam Question Snapshot

and enable later answer-persistence work.

EXACT OUT-OF-SCOPE:

- answer persistence
- answer acknowledgement
- Zero-Lost-Answer runtime
- autosave runtime
- local recovery buffer
- reconnect/resume runtime
- server-authoritative timer
- idempotent answer-save runtime
- submission
- Submission Receipt
- scoring/result finalization
- Exam Room
- proctoring
- Violation Event
- Risk Signal
- Incident
- Cheating Decision
- APIs
- frontend
- backend runtime/framework
- asset upload/delivery runtime
- authentication
- permission matrix
- deployment
- production hosting
- Production Blocker closure
- BU-004+

==================================================
SEMANTICS / RELATIONSHIP MATURITY
==================================================

Preserve:

QUESTION BANK ITEM:
editable/reusable source item.

EXAM QUESTION SNAPSHOT:
stable/immutable or governed frozen question truth for an exam context.

Question Bank edits must not silently mutate prepared, active, or historical exam question truth.

Do NOT claim Architecture mandates:

- exact physical FK shape
- composite key
- ORM relation
- event relation
- storage layout

BU-003 requires only a stable, tenant-safe association with applicable BU-002 Exam Instance context.

Exact physical representation remains a later bounded Build decision.

GLOBAL FK/EVENT STRATEGY:
PROVISIONAL

==================================================
TECHNOLOGY MATURITY
==================================================

Prior bounded persistence units used PostgreSQL + plain SQL versioned Git migrations.

BU-003 MAY reuse that local persistence foundation if later implementation design justifies it.

Do NOT claim global selection of:

- PostgreSQL 18
- backend language
- framework
- ORM
- frontend stack
- deployment topology
- final technology stack

GLOBAL FINAL TECHNOLOGY STACK:
NOT GLOBALLY SELECTED

==================================================
QUERY / PERFORMANCE GATE
==================================================

QUERY/PERFORMANCE GATE:
RELEVANT

TENANT ISOLATION / SECURITY:
ENFORCEMENT CONCERN

INDEX:
QUERY-PERFORMANCE / ACCESS-PATH CONCERN

Future implementation must:

- derive indexes from actual bounded access paths;
- evaluate tenant-scoped Question Bank retrieval;
- evaluate Exam-Instance-scoped Snapshot retrieval;
- avoid unnecessary unbounded/full-table reads;
- verify query plans when material executable queries exist;
- use EXPLAIN / EXPLAIN ANALYZE when justified;
- perform realistic-volume verification where applicable;
- keep transaction boundaries appropriately narrow;
- avoid unsupported arbitrary latency thresholds.

==================================================
VERIFICATION / DONE EXPECTATIONS
==================================================

Future implementation verification must cover:

- exact bounded concepts/schema;
- Question Bank Item != Exam Question Snapshot;
- Snapshot stability/immutability semantics;
- tenant-isolation invariants appropriate to actual implementation;
- stable association with applicable Exam Instance;
- no unauthorized additional BU-003 concept;
- no out-of-scope persistence expansion;
- query/access-plan verification where applicable;
- BU-001/BU-002 regression safety where applicable;
- migration verification;
- terminal verification.

Future DONE requires:

- bounded implementation complete;
- migration success;
- structural/invariant verification PASS;
- query/performance verification PASS where applicable;
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

PB-06:
OPEN

PB-07:
OPEN

BU-003 is structural groundwork only.

No Production Blocker closes.
