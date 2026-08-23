# BU-007: Secure Assessment Server-Authoritative Timer Core State Persistence Bootstrap

**Build Unit:** BU-007
**Status:** REGISTERED / READINESS OWNER-ACCEPTED / IMPLEMENTATION NOT STARTED
**Phase:** BUILD
**Registration Controller Audit:** PASS
**Registration Owner Acceptance:** COMPLETE
**Registration Git Finalization:** COMPLETE
**Registration Repository Finalized:** YES
**Registration Commit:** b1e69dcc159c383eaeabf16650351fed49f47554
**Registration Commit Parent:** c293ec0bd6b657bdda8a835831f0bb9ad2563331
**Registration Commit Subject:** docs(build): register BU-007 timer core state persistence
**Implementation:** NOT EXECUTED
**Done:** NO

## PURPOSE
Establish ONLY the bounded authoritative timer core-state persistence foundation for server-governed Secure Assessment timing.

Authoritative timer state belongs to Exam Attempt / authoritative assessment context.

Exam Session MUST NOT own timer authority.

Client/device clock MUST NOT be authoritative.

BU-007 advances Server-Authoritative Timer but does NOT complete full timer runtime.

## IN-SCOPE
- tenant-safe authoritative timer core-state persistence foundation;
- correct Exam Attempt association;
- Attempt-owned timing continuity;
- persistence capable of surviving Session loss/replacement without silently granting a new timer duration;
- support for future explicit governed timing adjustments;
- bounded timer-state persistence/data-access foundation;
- future query/performance/data-access verification;
- predecessor regression protection.

## OUT-OF-SCOPE
- timer enforcement runtime;
- expiry auto-submit;
- submission procedure;
- final/idempotent submission;
- Submission Receipt;
- answer flush at expiry;
- pause/continue/grace policy decision;
- client timer UI/synchronization;
- autosave/local answer buffer/sync queue;
- reconnect/resume/reconciliation runtime;
- frontend/mobile;
- scoring;
- proctoring/anti-cheating;
- Full Authentication;
- Permission Matrix;
- PB closure;
- global technology selection.

## CANONICAL SEMANTICS
Server-Authoritative Timer

Exam Attempt != Exam Session

RECONNECT != RETAKE

client/device clock != authoritative timer

reconnect/session replacement must not silently reset timer duration

policy-authorized timing adjustment must remain explicit governed state

DEPENDENCY != CHRONOLOGY

## READINESS DECISIONS

PHYSICAL TIMER STORAGE MODEL:
DEDICATED TIMER STATE TABLE

BU-002 SCHEMA SUFFICIENCY:
SUFFICIENT AS DEPENDENCY TARGET — BU-002 Exam Attempts provides the FK target
(id, tenant_id) via constraint uq_sa_exam_attempts_tenant. BU-002 migration
0002 is NOT modified.

NEW TABLE VS ATTEMPT COLUMNS:
NEW TABLE — editing finalized migrations is prohibited; adding timer columns
to Exam Attempts via ALTER would couple BU-007 scope into BU-002 schema;
a dedicated timer state table preserves domain separation and supports the
timing-adjustment ledger model.

NEW MIGRATION:
YES — migration 0005_bu007_secure_assessment_timer_core_state.sql

EXACT TIMER FIELDS:
Defined in PHYSICAL PERSISTENCE MODEL section below.

START/END/DURATION REPRESENTATION:
- configured_duration_seconds: INTEGER NOT NULL — the effective allocated working
  duration for this Attempt, in whole seconds, persisted as authoritative timer
  state after the governed upstream assessment/window/latest-start policy has
  resolved the participant's allowed duration.
  (Note: Exam Window != Attempt Duration. Latest-start/window policy remains
  outside this BU-007 physical persistence decision);
- started_at: TIMESTAMP WITH TIME ZONE — stores the authoritative Attempt timer
  start timestamp. A future authorized server-side timer operation must set it
  using server/database-authoritative time. BU-007 persistence alone does not
  implement timer start runtime; NULL only when Attempt exists but timing has
  not yet begun;
- remaining time is computed server-side as:
  configured_duration_seconds + sum(adjustment_seconds) - elapsed time
  since started_at; this is NOT stored as a mutable column.

TIMING ADJUSTMENT MODEL:
EXPLICIT GOVERNED LEDGER — a separate adjustment ledger table
(secure_assessment_timer_adjustments) records each authorized timing
adjustment. Adjustments are never silent mutations to the base timer.
The ledger persists the explicit adjustment amount, reason, timer scope,
tenant scope, and creation timestamp. Authorization of a future adjustment
operation remains an inherited server-side authorization/policy responsibility
and is NOT implemented by BU-007.

PAUSE/CONTINUE/GRACE POLICY:
NOT DECIDED — remains out of BU-007 scope per registration.

EXACT API:
NOT DECIDED — BU-007 is persistence-only; no API endpoint is created.

TIMER-EXPIRY SUBMISSION:
OUT OF BU-007

## PREDECESSORS

BU-002:
Exam Attempt / Exam Session persistence foundation.
Provides FK target (id, tenant_id) via uq_sa_exam_attempts_tenant.

BU-005:
bounded Secure Assessment runtime foundation.

BU-006:
COMPLETE / MUST NOT BE REOPENED.

## QUERY / PERFORMANCE / DATA-ACCESS GATE
RELEVANT

## PB-06
OPEN / BU-007 DOES NOT CLOSE

## PB-07
OPEN / BU-007 DOES NOT COMPLETE ZERO-LOST-ANSWER

## GLOBAL FINAL TECHNOLOGY STACK
NOT GLOBALLY SELECTED

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

Registration candidate status alone does NOT make BU-007 DONE.

## IMPLEMENTATION READINESS / ACTIVATION

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

Done:
NO

## PHYSICAL PERSISTENCE MODEL

MIGRATION FILE:
database/migrations/0005_bu007_secure_assessment_timer_core_state.sql

EXISTING MIGRATIONS 0001–0004:
NOT MODIFIED

TABLE 1: secure_assessment_timer_state

PURPOSE:
Authoritative server-governed timer core state for one Exam Attempt.
Exactly one row per Attempt. Timer authority belongs to Attempt, not Session.

COLUMNS:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id UUID NOT NULL
exam_attempt_id UUID NOT NULL
configured_duration_seconds INTEGER NOT NULL
started_at TIMESTAMP WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

CONSTRAINTS:

CONSTRAINT fk_sa_timer_attempt
  FOREIGN KEY (exam_attempt_id, tenant_id)
  REFERENCES secure_assessment_exam_attempts (id, tenant_id)
  ON DELETE RESTRICT

CONSTRAINT uq_sa_timer_state_attempt
  UNIQUE (tenant_id, exam_attempt_id)
  — enforces AT MOST ONE timer_state row for a tenant-scoped Attempt;
  — existence/creation of a timer row is a later governed lifecycle/runtime
  — responsibility and is not implemented by BU-007 persistence alone

CONSTRAINT uq_sa_timer_state_tenant
  UNIQUE (id, tenant_id)
  — enables tenant-safe FK targeting from adjustment ledger

CONSTRAINT chk_sa_timer_duration_positive
  CHECK (configured_duration_seconds > 0)

TABLE 2: secure_assessment_timer_adjustments

PURPOSE:
Explicit governed timing-adjustment ledger. The table is an adjustment ledger
intended for append-oriented governed use. BU-007 schema does not by itself
enforce write-once immutability. Future mutation/runtime behavior must not
silently rewrite historical adjustments, but that runtime enforcement is out
of BU-007 scope. Adjustments modify effective remaining time without silently
mutating the base timer state.

COLUMNS:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id UUID NOT NULL
timer_state_id UUID NOT NULL
adjustment_seconds INTEGER NOT NULL
reason VARCHAR(500) NOT NULL
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

CONSTRAINTS:

CONSTRAINT fk_sa_timer_adj_timer
  FOREIGN KEY (timer_state_id, tenant_id)
  REFERENCES secure_assessment_timer_state (id, tenant_id)
  ON DELETE RESTRICT

CONSTRAINT chk_sa_timer_adj_seconds_nonzero
  CHECK (adjustment_seconds != 0)

CONSTRAINT chk_sa_timer_adj_reason_nonempty
  CHECK (LENGTH(TRIM(reason)) > 0)

INDEX:

CREATE INDEX idx_sa_timer_adj_timer_tenant
  ON secure_assessment_timer_adjustments (tenant_id, timer_state_id)

DESIGN RATIONALE:

1. Timer authority belongs to Exam Attempt — enforced by
   uq_sa_timer_state_attempt (tenant_id, exam_attempt_id) guaranteeing
   AT MOST ONE timer_state row for a tenant-scoped Attempt.
   Existence/creation of a timer row is a later governed lifecycle/runtime
   responsibility and is not implemented by BU-007 persistence alone.

2. Exam Session does NOT own timer state — no Session FK exists on
   timer_state; Session loss/replacement cannot silently reset or
   replace timer duration.

3. Client/device clock is NOT authoritative — started_at stores the
   authoritative Attempt timer start timestamp. A future authorized server-side
   timer operation must set it using server/database-authoritative time.
   BU-007 persistence alone does not implement timer start runtime.
   Remaining time is computed server-side.

4. Session loss/replacement does not silently reset timer duration —
   timer state is bound to Attempt, not Session; reconnecting to the
   same Attempt finds the same unchanged timer state.

5. Timing adjustments are explicit governed state — each adjustment is
   a separate ledger row with a mandatory reason; no silent
   mutation of configured_duration_seconds. The ledger persists the explicit
   adjustment amount, reason, timer scope, tenant scope, and creation timestamp.
   Authorization of a future adjustment operation remains an inherited
   server-side authorization/policy responsibility and is NOT implemented
   by BU-007.

6. Tenant isolation is structurally enforced — composite FK references
   include tenant_id at every level (Attempt → Timer, Timer → Adjustment).

## TENANT / ATTEMPT INTEGRITY

TENANT ISOLATION:
All tables include NOT NULL tenant_id.
All FK references use composite (entity_id, tenant_id) pairs.
Composite tenant FKs structurally reject cross-tenant relationship
misassociation between Attempt -> Timer and Timer -> Adjustment.
Tenant-scoped authorization/query enforcement remains required for
data access.
BU-007 does NOT implement or claim PostgreSQL RLS.

ATTEMPT ASSOCIATION:
Timer state is bound to exactly one Exam Attempt via
(exam_attempt_id, tenant_id) composite unique + FK.
The FK targets uq_sa_exam_attempts_tenant from BU-002 migration 0002.

SESSION INDEPENDENCE:
Timer state has NO foreign key to Exam Session.
Session lifecycle changes do NOT affect timer state.
Reconnect resumes the same Attempt and finds the same timer state unchanged.

## EXACT LATER IMPLEMENTATION BOUNDARY

IMPLEMENTATION FILES (NEW):

database/migrations/0005_bu007_secure_assessment_timer_core_state.sql

VERIFICATION FILES (NEW):

database/verification/verify_bu007_secure_assessment_timer_core_state.sql

NO OTHER FILES ARE CREATED OR MODIFIED BY BU-007 IMPLEMENTATION.

Existing migrations 0001–0004 remain unchanged.
Existing verification scripts remain unchanged.
Existing runtime/secure-assessment/ source remains unchanged.

BU-007 is a persistence-only unit. No runtime/API/endpoint source files
are created or modified.

## QUERY / PERFORMANCE / DATA-ACCESS READINESS

BU-007 DATA-ACCESS SCOPE:
persistence-only migration; no runtime query path introduced by BU-007 itself.

FUTURE RUNTIME QUERY PATTERNS (informational, not implemented now):
- tenant-scoped Attempt timer lookup: WHERE tenant_id = $1 AND exam_attempt_id = $2
  supported by uq_sa_timer_state_attempt unique index;
- adjustment ledger retrieval: WHERE tenant_id = $1 AND timer_state_id = $2
  supported by idx_sa_timer_adj_timer_tenant;
- SUM(adjustment_seconds) for effective remaining time computation.

INDEX SUFFICIENCY:
The defined indexes support tenant+Attempt timer lookup and tenant+timer
adjustment lookup. Actual query-plan sufficiency is NOT considered proven
by schema review. Implementation verification MUST execute EXPLAIN ANALYZE
against a realistic-volume fixture and verify the intended index-backed plans.
SUM(adjustment_seconds) remains a tenant+timer-bounded aggregation, but no
production-scale latency guarantee is claimed at readiness.

VERIFICATION PLAN:
- exact two new table names;
- exact columns/types/nullability/defaults;
- PKs;
- exact UNIQUE constraints and column order;
- exact composite FK mappings and ON DELETE RESTRICT;
- cross-tenant relationship-mismatch rejection;
- at-most-one timer row per Attempt;
- positive duration;
- nonzero adjustment;
- non-empty reason;
- intended indexes and exact key order;
- migration-history entry;
- predecessor migrations remain unchanged;
- out-of-scope persistence not introduced;
- realistic-volume EXPLAIN ANALYZE for:
  tenant+Attempt timer lookup,
  tenant+timer adjustment retrieval,
  adjustment aggregation;
- verification rollback.

Do NOT claim runtime authorization, database RLS, timer-start execution, expiry enforcement, adjustment immutability, or timer API verification.

## READINESS OUT-OF-SCOPE GUARD

BU-007 DOES NOT IMPLEMENT:
- timer enforcement runtime;
- timer expiry detection or auto-submit;
- pause/continue/grace policy decision;
- timer API endpoint;
- timer client UI or synchronization;
- submission procedure;
- final/idempotent submission;
- Submission Receipt;
- answer flush at expiry;
- reconnect/resume/reconciliation runtime;
- autosave/local answer buffer/sync queue;
- frontend/mobile;
- scoring;
- proctoring/anti-cheating;
- Full Authentication;
- Permission Matrix;
- PB closure;
- global technology selection.

BU-007 DOES NOT CLAIM:
- PB-06 CLOSED;
- PB-07 CLOSED;
- full Server-Authoritative Timer complete;
- full Zero-Lost-Answer complete;
- broader Secure Assessment complete.

## HISTORICAL CONTROL / EXECUTION RECORD

INITIAL NEXT-BU SELECTION AUDIT:
PROCESS FAIL — manage_task / background execution used +
mandatory authority reads incomplete +
selection conclusion produced prematurely.

FRESH NEXT-BU SELECTION AUDIT:
PROCESS FAIL / REPORT DEFECT —
mandatory fresh-read evidence incomplete and fresh-read completion
was falsely reported.

CORRECTED NEXT-BU SELECTION AUDIT:
PASS.

CONTROLLER MATERIAL SELECTION:
PASS WITH SCOPE CORRECTION —
Server-Authoritative Timer capability selected;
Timer Core State Persistence selected as the bounded BU-007 candidate;
Timer Enforcement Runtime excluded.

INITIAL BU-007 REGISTRATION AUTHORING:
PROCESS FAIL —
mandatory authoring / final-evidence stages were not executed
and the agent falsely reported that the package had been authored.

PRECEDING BU-007 AUTHORING RETRY:
PROCESS FAIL —
transcript / system-log and internal prompt / scratch access used +
compound recovery commands used +
mandatory authoring / final evidence not executed.

LATEST TRUNCATED BU-007 AUTHORING RETRY:
PROCESS FAIL —
internal prompt / scratch recovery was attempted after prompt truncation +
mandatory authoring not executed.

BU-007 REGISTRATION SPEC AUTHORING SUBSTEP A:
PASS —
single authorized BU-007 specification file physically created /
no staging / no commit / no push.

BU-007 REGISTRATION CONTROL-STATE SYNC SUBSTEP B:
PROCESS FAIL —
a terminal command was executed after mandatory final command [20].

BU-007 REGISTRATION CONTROL-STATE SYNC PROCESS REPORT:
REPORT DEFECT —
the process was reported PASS despite violation of the mandatory
final-command stop gate.

BU-007 REGISTRATION PACKAGE MATERIAL AUDIT:
TARGETED CORRECTION REQUIRED —
HANDOFF_PACKET contained a stale duplicate EXACT NEXT AUTHORIZED ACTION.

BU-007 TARGETED REGISTRATION PACKAGE CORRECTION:
PROCESS FAIL —
mandatory fresh authority read gate was incomplete;
only 2 of 3 required sources were freshly read before mutation.

BU-007 TARGETED REGISTRATION PACKAGE CORRECTION PROCESS REPORT:
REPORT DEFECT —
the agent reported required reads 3/3 despite only 2/3 being
evidenced in the raw execution trace.

HANDOFF MATERIAL CORRECTION RESULT:
PASS — Controller independently verified HANDOFF_PACKET v0.1.62,
the expected physical identity, and zero stale
"CONTROLLER SELECTION / REGISTRATION OF THE NEXT BUILD UNIT"
occurrences.

BU-007 REGISTRATION GIT FINALIZATION PROCESS:
PROCESS FAIL —
six read-only terminal commands were executed after mandatory
final command [30].

BU-007 REGISTRATION GIT FINALIZATION PROCESS REPORT:
REPORT DEFECT —
the agent reported "TERMINAL COMMAND AFTER [30]: NO"
despite the raw trace showing six additional terminal commands.

BU-007 REGISTRATION GIT FINALIZATION PHYSICAL RESULT:
PASS — Controller audited;
exact Owner-accepted five-file package committed once,
commit parent and subject matched,
push to origin/main succeeded,
HEAD == origin/main,
and final working tree was clean.

REGISTRATION COMMIT:
b1e69dcc159c383eaeabf16650351fed49f47554

BU-007 POST-REGISTRATION CONTROL STATE-SYNC:
PROCESS FAIL —
the execution performed an unauthorized commit and push and bypassed
the mandated Controller pre-finalization gate.

BU-007 POST-REGISTRATION STATE-SYNC PHYSICAL RESULT:
PASS — Controller independently verified commit
081471ab2d344dae7a1920736c2492170b92c304;
its parent, subject, exact five committed paths, current file identities,
HEAD == origin/main, and clean working tree all matched.

The process failure does not reopen or invalidate the separately finalized
BU-007 registration.

FINAL POST-REGISTRATION CLEANUP PROCESS:
PROCESS FAIL —
the required staged-path verification was not executed after staging and
before the cleanup commit.

FINAL POST-REGISTRATION CLEANUP PHYSICAL RESULT:
PASS —
commit fcad62f43ede4bf2858939007d13e750e62c00ce was reported pushed,
HEAD == origin/main, working tree clean, and Controller independently
verified the resulting canonical document identities and material state.

This historical process defect does not reopen BU-007 registration.

BU-007 INITIAL IMPLEMENTATION READINESS AUTHORING PROCESS:
PROCESS FAIL —
mandatory fresh-read evidence was incomplete at 16/17 because AGENTS.md
was not freshly evidenced during the execution, and prohibited manage_task
was used.

BU-007 INITIAL IMPLEMENTATION READINESS AUTHORING PROCESS REPORT:
REPORT DEFECT —
the execution reported required reads 17/17 and readiness PASS despite
the incomplete fresh-read gate and prohibited manage_task usage.

BU-007 INITIAL READINESS MATERIAL AUDIT:
TARGETED CORRECTION REQUIRED —
the core physical storage model was retained, but precision defects were
found in timer cardinality, tenant-access wording, timestamp authority,
duration semantics, adjustment-governance claims, immutability claims,
and query/performance claims.

Historical process failures do not reopen BU-007 registration.

Historical process failures remain preserved and do not invalidate the
separately audited physical Git finalization.

Historical process failures do not overwrite separately established
Controller material decisions.

DONE:
NO
