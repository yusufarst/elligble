# BU-032 Secure Assessment Client Server-Derived Expiry Observation Finalization Trigger Runtime Foundation Bootstrap

**Status:** FAST-TRACK MAIN EXECUTION COMPLETE / IMPLEMENTATION REPOSITORY FINALIZED / AWAITING CONTROLLER PHYSICAL AUDIT
**Version:** 1.0.0
**Source:** Canonical Discovery (D04.01)

## 1. Goal
Register and freeze a small UI-agnostic client-runtime bridge that consumes already-server-derived authoritative assessment state and invokes the existing BU-031 expiry-finalization coordinator only when that authoritative state establishes expiry.

This unit closes the missing orchestration bridge between:
server-derived timer/submission observation
→ authoritative expiry determination from supplied server state
→ existing BU-031 reconciliation/finalization coordinator

It MUST NOT derive expiry from the device clock.

## 2. Frozen Stage-2 Implementation Paths
1. `runtime/secure-assessment/src/client-authoritative-expiry-trigger.ts`
2. `runtime/secure-assessment/test/client-authoritative-expiry-trigger.test.ts`

## 3. Canonical Basis
Preserve:
* D04.5-45 — timer expiry requires a defined Submission procedure.
* D04.5-46 — pending responses should be flushed where connectivity permits.
* D04.5-47 — server may finalize from last authoritative accepted answers.
* D04.5-48 — local-only unsynced answers must never masquerade as server-received.
* D04.5-49 — expiry finalization remains idempotent.
* BU-016 — existing server-side expiry finalization.
* BU-031 — existing client reconciliation-before-finalization coordinator.
* existing reconnect/resume server-derived timer/submission readback.

## 4. Substantive Target
Create a callable runtime primitive. Input represents an assessment state already obtained from an authoritative/server-derived source.
At minimum the input must carry semantically equivalent information for:
* attemptId
* timer status
* effectiveRemainingSeconds when timer is active
* submission status
* existing authoritative submission receipt when already submitted

The primitive MUST NOT fetch current time or calculate elapsed time itself.

## 5. Required Semantics

1. **AUTHORITATIVE STATE VALIDATION:**
   * supplied attemptId matches the supplied recovery/finalization scope attemptId
   * active timer effectiveRemainingSeconds is a safe integer >= 0
   * submitted state contains a valid non-empty authoritative submissionId and submittedAt
   * contradictory/malformed authoritative observation is rejected conservatively. Do not fabricate missing authoritative data.

2. **NOT STARTED / NOT EXPIRED:**
   When authoritative observation reports timer not started:
   * do not invoke BU-031 coordinator;
   * return an explicit no-finalization semantic equivalent to `not_expired`.
   When authoritative active timer reports `effectiveRemainingSeconds > 0`:
   * do not invoke BU-031 coordinator;
   * return `not_expired`.

3. **AUTHORITATIVE EXPIRY:**
   When authoritative observation reports:
   `submission.status === 'not_submitted'` AND `timer.status === 'active'` AND `effectiveRemainingSeconds === 0`
   then invoke the existing BU-031 expiry-finalization coordinator exactly once per orchestration call.
   Do not duplicate BU-031 reconciliation logic.
   Propagate BU-031 outcomes honestly: `submitted`, `pending_answers_unresolved`, `finalization_uncertain`.

4. **ALREADY SUBMITTED:**
   If authoritative supplied state already contains a valid submitted receipt:
   * do not invoke BU-031 coordinator;
   * return the authoritative submitted receipt unchanged.

5. **INVALID / CONTRADICTORY AUTHORITATIVE STATE:**
   Examples: attemptId mismatch; negative remaining time; non-integer/unsafe remaining time; submitted state with invalid receipt; unsupported timer/submission combination.
   Return an explicit conservative result semantically equivalent to `authoritative_state_invalid` and do not call BU-031 finalization coordinator.

6. **DEVICE CLOCK PROHIBITION:**
   Do not use `Date.now()`, `new Date()` for expiry determination, `performance.now()`, device clock, locally elapsed duration, or local countdown as authority. The server-derived `effectiveRemainingSeconds` is the decision input.

7. **NO BACKGROUND TRIGGERING:**
   Do not add `setInterval`, polling, scheduler, cron, background task, manage_task/taskification. BU-032 is a callable integration primitive, not a scheduler.

8. **NO UI / STACK SELECTION:**
   Do not introduce React, Vite, DOM, UI components, frontend application package, or new global technology selection.

## 6. Frozen Minimum Result States
At minimum:
* submitted
* not_expired
* pending_answers_unresolved
* finalization_uncertain
* authoritative_state_invalid

## 7. Frozen Minimum Stage-2 Tests
1. timer not started + not submitted → not_expired → coordinator never called
2. positive authoritative remaining seconds → not_expired → coordinator never called
3. authoritative remaining seconds = 0 + not submitted → coordinator called exactly once
4. expired coordinator returns submitted → same receipt propagated unchanged
5. expired coordinator returns pending_answers_unresolved → propagated honestly
6. expired coordinator returns finalization_uncertain → propagated honestly
7. authoritative observation already submitted → coordinator never called → exact receipt propagated unchanged
8. attemptId mismatch → authoritative_state_invalid → coordinator never called
9. negative remaining seconds → authoritative_state_invalid
10. fractional / NaN / unsafe integer remaining seconds → authoritative_state_invalid
11. malformed submitted receipt → authoritative_state_invalid
12. supplied scope/observation not mutated
13. source contains no device-clock expiry derivation
14. no scheduler/polling/background behavior

## 8. Non-Goals
BU-032 must NOT:
* modify resume.ts
* modify submission.ts
* modify timer.ts
* modify client-expiry-finalization.ts
* modify recovery/reconciliation files
* implement network polling
* implement UI
* choose frontend technology
* modify Capability Matrix
* promote SEC-033
* close PB06
* close PB07
* register BU-033

## 9. Current Stage
**Version:** 1.0.0
**Status:** REGISTERED / CONTROLLER SCOPE FREEZE COMPLETE / NOT STARTED
**Artifact Type:** BUILD UNIT SPECIFICATION

## 10. Exit Semantics
REGISTERED / CONTROLLER SCOPE FREEZE COMPLETE / NOT STARTED

DONE:
NO

CONTROLLER PHYSICAL AUDIT:
NOT YET

FAST-TRACK LIFECYCLE CLOSE:
NOT YET

FINAL PHYSICAL VERIFICATION:
NOT YET
