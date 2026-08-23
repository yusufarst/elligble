# BU-007: Secure Assessment Server-Authoritative Timer Core State Persistence Bootstrap

**Build Unit:** BU-007
**Status:** REGISTRATION CANDIDATE / NOT STARTED
**Phase:** BUILD
**Registration Controller Audit:** PENDING
**Registration Owner Acceptance:** NOT YET
**Registration Git Finalization:** NOT COMPLETE
**Registration Repository Finalized:** NO
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
PHYSICAL TIMER STORAGE MODEL: READINESS DECISION REQUIRED
BU-002 SCHEMA SUFFICIENCY: READINESS DECISION REQUIRED
NEW TABLE VS ATTEMPT COLUMNS: READINESS DECISION REQUIRED
NEW MIGRATION: READINESS DECISION REQUIRED
EXACT TIMER FIELDS: READINESS DECISION REQUIRED
START/END/DURATION REPRESENTATION: READINESS DECISION REQUIRED
TIMING ADJUSTMENT MODEL: READINESS DECISION REQUIRED
PAUSE/CONTINUE/GRACE POLICY: NOT DECIDED
EXACT API: NOT DECIDED
TIMER-EXPIRY SUBMISSION: OUT OF BU-007

## PREDECESSORS
BU-002:
Exam Attempt / Exam Session persistence foundation.

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

Historical process failures do not overwrite separately established
Controller material decisions.

DONE:
NO
