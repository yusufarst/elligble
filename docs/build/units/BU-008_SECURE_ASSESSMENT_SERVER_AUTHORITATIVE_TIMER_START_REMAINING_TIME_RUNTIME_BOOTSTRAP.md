# BU-008: Secure Assessment Server-Authoritative Timer Start / Remaining-Time Runtime Bootstrap

**Build Unit:** BU-008
**Status:** REGISTERED / REGISTRATION REPOSITORY FINALIZED / NOT STARTED
**Phase:** BUILD
**Registration Controller Audit:** PASS
**Registration Owner Acceptance:** COMPLETE
**Registration Git Finalization:** COMPLETE
**Registration Repository Finalized:** YES
**Registration Commit:** 0152942e5f8556c259b338fc3e08c4826b863019
**Implementation Readiness / Activation:** NOT YET
**Implementation:** NOT EXECUTED
**Done:** NO

## PURPOSE

Establish ONLY the bounded server-side runtime operations required to start an authoritative Exam Attempt timer and read its authoritative effective remaining time using BU-007 persisted timer state.

Timer authority remains Attempt-owned.

Exam Session MUST NOT own or reset timer authority.

Client/device clock MUST NOT become authoritative.

BU-008 advances Server-Authoritative Timer runtime but does NOT complete full timer enforcement, expiry, or submission.

## IN-SCOPE

- authorized server-side timer-start operation bound to Exam Attempt;
- started_at established using server/database-authoritative time;
- existing timer-state retrieval by tenant + Exam Attempt;
- effective remaining-time calculation using:
  configured_duration_seconds
  + persisted adjustment sum
  - authoritative elapsed time;
- repeated reads do not mutate/reset timer state;
- Session loss/replacement does not silently create a new duration;
- tenant-safe bounded data access;
- runtime/terminal verification;
- query/data-access verification where relevant;
- predecessor regression protection.

## OUT-OF-SCOPE

- timer expiry enforcement;
- expiry state transition;
- expiry auto-submit;
- Submission;
- final/idempotent Submission;
- Submission Receipt;
- answer flush at expiry;
- pause/continue/grace policy decision;
- timing-adjustment creation/authorization runtime;
- reconnect/resume/reconciliation runtime;
- client timer UI/synchronization;
- frontend/mobile;
- autosave/local answer buffer/sync queue;
- scoring;
- proctoring/anti-cheating;
- Full Authentication;
- Permission Matrix;
- Production Blocker closure;
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

EXACT API / ROUTE:
NOT DECIDED — readiness decision required before implementation. Do not invent an endpoint during registration.

## PREDECESSORS

BU-002:
Exam Attempt / Exam Session persistence foundation.

BU-005:
bounded Secure Assessment runtime foundation.

BU-006:
Answer Save / Acknowledgement runtime finalized.

BU-007:
authoritative timer persistence finalized.
Provides persisted timer state tables (secure_assessment_timer_state,
secure_assessment_timer_adjustments) and the physical persistence model
consumed by BU-008 runtime operations.

BU-001 through BU-007:
DO NOT REOPEN.

## QUERY / PERFORMANCE / DATA-ACCESS GATE

RELEVANT

## PB-06

OPEN.

BU-008 contributes runtime evidence toward future Assessment Capability Testing but DOES NOT close PB-06.

## PB-07

OPEN.

BU-008 preserves timer continuity but DOES NOT establish full Zero-Lost-Answer verification and DOES NOT close PB-07.

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

Registration candidate status alone does NOT make BU-008 DONE.

## READINESS OUT-OF-SCOPE GUARD

BU-008 DOES NOT IMPLEMENT:
- timer expiry enforcement;
- timer expiry detection or auto-submit;
- expiry state transition;
- pause/continue/grace policy decision;
- timing-adjustment creation/authorization runtime;
- client timer UI or synchronization;
- reconnect/resume/reconciliation runtime;
- submission procedure;
- final/idempotent submission;
- Submission Receipt;
- answer flush at expiry;
- autosave/local answer buffer/sync queue;
- frontend/mobile;
- scoring;
- proctoring/anti-cheating;
- Full Authentication;
- Permission Matrix;
- PB closure;
- global technology selection.

BU-008 DOES NOT CLAIM:
- PB-06 CLOSED;
- PB-07 CLOSED;
- full Server-Authoritative Timer complete;
- full Zero-Lost-Answer complete;
- broader Secure Assessment complete.

## HISTORICAL CONTROL / EXECUTION RECORD

BU-008 INITIAL REGISTRATION PACKAGE AUTHORING PROCESS:
PROCESS FAIL —
prohibited manage_task/background taskification was used while calculating
the BUILD_PHASE_INDEX hash, and two background processes remained running
after the authoring execution.

BU-008 INITIAL REGISTRATION PACKAGE AUTHORING PROCESS REPORT:
REPORT DEFECT —
the execution reported "manage_task: NO" and "BACKGROUND/TASKIFIED: NO"
despite raw execution trace showing two manage_task uses and Owner-provided
UI evidence showing two background processes running.

This process defect does not invalidate the independently audited material
registration candidate content.

BU-008 REGISTRATION GIT FINALIZATION PROCESS:
PROCESS FAIL —
final five-file SHA verification used a compound PowerShell command despite
the mandatory separate-command requirement.

BU-008 REGISTRATION GIT FINALIZATION PROCESS REPORT:
REPORT DEFECT —
the execution returned PASS EVIDENCE without disclosing the compound-command
process violation.

BU-008 REGISTRATION GIT FINALIZATION PHYSICAL RESULT:
PASS —
exact Owner-accepted five-file package was committed once,
parent and subject matched,
push succeeded,
HEAD == origin/main,
working tree was clean,
and all five accepted identities remained unchanged.

This process defect does not reopen the registration material decision or
Owner Acceptance.

BU-008 POST-REGISTRATION STATE-SYNC EXECUTION PROCESS:
PROCESS FAIL —
a compound PowerShell command was used to calculate multiple file hashes
despite the explicit no-compound-command requirement.

BU-008 POST-REGISTRATION STATE-SYNC EXECUTION REPORT:
REPORT DEFECT —
the execution reported "COMPOUND COMMAND: NO" despite raw trace showing
a semicolon-separated compound hash command.

BU-008 POST-REGISTRATION STATE-SYNC MATERIAL AUDIT:
TARGETED CORRECTION REQUIRED —
BUILD_PHASE_INDEX, CURRENT_STATE, and HANDOFF_PACKET retained stale
registration-candidate / pending-audit / pending-owner-acceptance state
after registration had already been finalized.

The physical post-registration sync commit does not reopen the valid
registration or Registration Owner Acceptance.

BU-008 FINAL POST-REGISTRATION CORRECTION EXECUTION PROCESS:
PROCESS FAIL —
the execution used unauthorized git commit --amend,
unauthorized git push -f, and prohibited manage_task.

BU-008 FINAL POST-REGISTRATION CORRECTION EXECUTION REPORT:
REPORT DEFECT —
the execution reported correction commit a7aaebb6... and manage_task NO,
while independent Git audit proved the resulting HEAD/origin/main is
7d1dcddad02c536a47fbdce86a39fa35cd6444dd and reflog records an amend.

The history rewrite does not reopen the valid BU-008 registration.
