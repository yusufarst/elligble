# BU-005: Secure Assessment Minimum Runtime Foundation Bootstrap

Lifecycle state:

Build Unit:
BU-005

Status:
REGISTERED / NOT STARTED

Phase:
BUILD

Implementation:
NOT EXECUTED

Terminal Verification:
NOT EXECUTED

Query/Performance Verification:
NOT EXECUTED

Implementation Owner Acceptance:
NOT YET

Registration Owner Acceptance:
COMPLETE

Registration Git Finalization:
COMPLETE

Registration Repository Finalized:
YES

Registration Commit:
04459d873c53a406f5bcb9f1fc7b22b4910b5235

Implementation Readiness / Activation:
NOT EXECUTED

Readiness Owner Acceptance:
NOT YET

Readiness Git Finalization:
NOT COMPLETE

Readiness Repository Finalized:
NO

Implementation Repository Finalized:
NO

Done:
NO

PURPOSE:

Establish ONLY the minimum executable Secure Assessment backend/runtime
foundation required to host later bounded active-exam runtime capabilities,
without implementing those capabilities and without globally selecting the
final ELLIGBLE technology stack.

The foundation must be sufficient for later Build Units to attach executable
Secure Assessment behavior to the persisted state already established by
BU-002, BU-003, and BU-004.

==================================================
CONTROLLER-APPROVED DERIVATION
==================================================

The derivation rationale is:

1. BU-002 established core Secure Assessment persisted Attempt/Session context.
2. BU-003 established Question Bank Item / immutable Exam Question Snapshot persistence groundwork.
3. BU-004 established authoritative Answer Persistence groundwork.
4. The repository currently has no clean executable application/backend runtime foundation.
5. Executable future Secure Assessment guarantees including:
   - Zero-Lost-Answer runtime;
   - reconnect/resume/reconciliation;
   - Server-Authoritative Timer runtime;
   - Submission/idempotency runtime;
   require an application/runtime host.
6. Persistence-only Timer or Submission groundwork may be technically capable of proceeding independently, but that does not remove the shared runtime prerequisite.
7. Therefore BU-005 is selected as the smallest shared technical prerequisite that unlocks later runtime Build Units.

This is NOT a claim that Architecture canonically mandated BU-005 as a numbered delivery step.
It is a Build dependency derivation consistent with repository authority.

==================================================
EXACT FUTURE IMPLEMENTATION IN-SCOPE
==================================================

- one bounded backend/runtime application host;
- deterministic startup and shutdown lifecycle;
- environment/configuration loading boundary;
- dependency initialization/wiring required by that host;
- bounded connectivity to the existing persistence foundation;
- runtime/database dependency readiness verification;
- minimal non-domain health/readiness mechanism where required for runtime verification;
- minimal structured runtime logging / observable startup, shutdown, and dependency-health evidence;
- test/verification bootstrap required to launch the bounded runtime against a disposable or controlled verification environment;
- foundation hooks that later Build Units may consume without implementing the later business behavior now.

Do NOT require a particular language/framework/vendor during registration.
Do NOT turn BU-005 into a general-purpose platform backend.
The unit is the minimum Secure-Assessment-priority runtime bootstrap.

==================================================
EXACT OUT-OF-SCOPE
==================================================

- Answer persistence schema changes;
- Question persistence changes;
- Exam Attempt/Session schema changes;
- new Secure Assessment business schema unless later separately approved;
- client autosave;
- client pending-answer buffer;
- IndexedDB/localStorage selection;
- Zero-Lost-Answer runtime logic;
- answer retry/reconciliation logic;
- reconnect/resume behavior;
- Server-Authoritative Timer behavior;
- timer persistence unless separately registered later;
- final submission;
- idempotency-key behavior;
- Submission Receipt;
- scoring;
- result finalization;
- Exam Room;
- proctoring;
- Violation Event;
- Risk Signal;
- Incident;
- Cheating Decision;
- business/domain API endpoints;
- frontend;
- mobile apps;
- full authentication implementation;
- permission matrix implementation;
- message broker;
- event bus;
- cache;
- production deployment;
- production hosting;
- cloud/vendor selection;
- Production Blocker closure;
- BU-006+.

A minimal non-domain runtime health/readiness mechanism does NOT authorize business APIs.

==================================================
CANONICAL INVARIANTS
==================================================

Preserve explicitly:

ZERO LOST ANSWERS

CLIENT/PENDING ANSWER STATE != SERVER-ACKNOWLEDGED AUTHORITATIVE ANSWER STATE

RECONNECT != RETAKE

Student != Exam Participant != Exam Attempt != Exam Session

Assessment Type != Exam Instance

Question Bank Item != immutable Exam Question Snapshot

Teacher != Proctor

Violation Event != Risk Signal != Incident != Cheating Decision

Risk Signal != verdict.

network/IP/location/device/reconnect context != cheating proof.

Exam Session loss must not inherently imply Answer loss.

BU-005 runtime bootstrap must not silently take ownership of canonical state owned by Identity, Tenant, Academic Core, or other domains.

==================================================
DOMAIN / OWNERSHIP / TENANCY BOUNDARY
==================================================

Secure Assessment remains owner of Secure Assessment business/runtime state created in assessment context as established by Architecture.

BU-005 itself introduces only runtime-host infrastructure boundaries.
It does NOT redefine domain ownership.
It must preserve tenant context and must not establish cross-tenant access.
Any future persistence access from the runtime must operate through explicit tenant-aware boundaries inherited from completed persistence units.
Do not invent a new tenancy model.

==================================================
TECHNOLOGY MATURITY
==================================================

GLOBAL FINAL TECHNOLOGY STACK:
NOT GLOBALLY SELECTED

GLOBAL FK/EVENT STRATEGY:
PROVISIONAL

POSTGRESQL 18 GLOBAL SELECTION:
NO

INSFORGE:
NOT GLOBALLY SELECTED OR REJECTED BY BU-005 REGISTRATION

BACKEND LANGUAGE:
NOT SELECTED BY REGISTRATION

BACKEND FRAMEWORK:
NOT SELECTED BY REGISTRATION

API FRAMEWORK:
NOT SELECTED BY REGISTRATION

ORM:
NOT SELECTED BY REGISTRATION

MESSAGE BROKER:
NOT SELECTED BY REGISTRATION

CACHE:
NOT SELECTED BY REGISTRATION

CLOUD / DEPLOYMENT:
NOT SELECTED BY REGISTRATION

BU-005 may later require a bounded local runtime technology choice.
That choice MUST occur in a separate readiness/activation gate before implementation.
Any future local selection must be explicitly scoped to BU-005 and must NOT be represented as global final-stack selection.

==================================================
IMPLEMENTATION PRECONDITION / READINESS GATE
==================================================

BU-005 REGISTRATION itself is NOT implementation readiness approval.

Define a later mandatory:
BU-005 IMPLEMENTATION READINESS / ACTIVATION GATE

Before implementation, that gate must determine at minimum:
- the bounded local backend/runtime implementation choice;
- required language/runtime;
- minimal framework/no-framework approach;
- dependency/package strategy;
- configuration strategy;
- database connectivity mechanism;
- minimal health/readiness mechanism;
- test/runtime verification strategy;
- startup/shutdown execution model;
- compatibility with current repository/tooling;
- how the choice remains local to BU-005 rather than global stack selection.

Readiness must be Controller-audited and Owner-accepted/finalized under the existing lifecycle before implementation starts.
Do NOT make those technology selections during this registration execution.

==================================================
FUTURE VERIFICATION EXPECTATIONS
==================================================

1. deterministic runtime startup PASS;
2. deterministic clean shutdown PASS;
3. no orphan/background runtime processes after verification;
4. configuration success path PASS;
5. malformed/missing required configuration failure path PASS;
6. persistence dependency connectivity PASS against a controlled/disposable verification environment;
7. migrations 0001-0004 remain valid and unchanged;
8. no unintended schema changes;
9. no domain/business runtime capability implemented outside BU-005 scope;
10. no cross-tenant behavior introduced;
11. health/readiness semantics, if implemented, accurately reflect bounded runtime dependency state;
12. observable startup/shutdown/dependency evidence;
13. predecessor regression verification where materially required;
14. terminal verification foreground-only and bounded;
15. implementation source identities captured before Owner Acceptance.

==================================================
QUERY / PERFORMANCE / RUNTIME GATE
==================================================

BU-005 has a runtime/data-access gate, but it is NOT a domain-query performance unit.

Registration must require later implementation to prove where applicable:
- bounded database connection lifecycle;
- bounded connection-pool configuration if pooling exists;
- no uncontrolled connection creation;
- no N+1 behavior in any bootstrap persistence access;
- no unbounded SELECT;
- no broad table scan merely for health/readiness;
- narrow/no unnecessary transaction boundaries;
- bounded query count during startup/readiness checks;
- latency evidence where meaningful;
- no arbitrary unsupported latency SLO;
- observability for dependency connection failures;
- clean handling of database unavailable/recovered states within BU-005 scope.

If the implementation uses only a trivial connectivity probe such as SELECT 1, do NOT invent meaningless EXPLAIN requirements.

If BU-005 later introduces any real persisted-state lookup, that query must have:
- bounded predicates/projection;
- appropriate indexes;
- EXPLAIN / EXPLAIN ANALYZE where meaningful;
- realistic-volume evidence where relevant;
- no planner forcing.

==================================================
FAILURE / BLOCKED CONDITIONS
==================================================

Future implementation is BLOCKED if:
- readiness/activation has not passed;
- implementation requires silent global technology-stack selection;
- the proposed runtime choice contradicts LOCKED Architecture;
- implementation expands into Zero-Lost-Answer/reconnect/timer/submission;
- schema/domain work appears outside the registered unit;
- tenant isolation is weakened;
- unrelated Owner work is present;
- required predecessor repository state does not match;
- verification requires uncontrolled background execution;
- material verification cannot return normally.

==================================================
PRODUCTION BLOCKER RELATIONSHIP
==================================================

PB:
12 OPEN / 0 RESOLVED

PB-06:
OPEN

PB-07:
OPEN

BU-005 is technical runtime groundwork.
BU-005 registration does NOT close a Production Blocker.
BU-005 implementation alone must NOT claim PB-06 CLOSED or PB-07 CLOSED.
Zero-Lost-Answer verification requires later actual runtime capability and verification evidence.

==================================================
DONE CRITERIA
==================================================

Future BU-005 DONE requires at minimum:
- registration complete;
- registration Controller audit PASS;
- registration Owner Acceptance COMPLETE;
- registration controlled Git finalization;
- mandatory readiness/activation PASS;
- readiness Owner Acceptance/finalization where required;
- bounded implementation complete;
- required verification PASS;
- Controller independent audit PASS;
- implementation Owner Acceptance COMPLETE;
- controlled Git finalization;
- repository finalized;
- required closure/state synchronization finalized.
