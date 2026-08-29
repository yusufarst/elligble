# BU-031 Secure Assessment Client Authoritative Expiry Finalization Reconciliation Gate Runtime Foundation Bootstrap

**Status:** COMPLETE / PRIOR CONTROLLER PHYSICAL AUDIT FAIL / FIRST TARGETED REMEDIATION COMPLETE / FIRST CONTROLLER PHYSICAL RE-AUDIT FAIL / SECOND TARGETED REMEDIATION COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PASS / FAST-TRACK LIFECYCLE CLOSE COMPLETE / FAST-TRACK REPOSITORY FINALIZED
**Version:** 1.0.0
**Source:** Canonical Discovery (D04.01)

## 1. Goal
Register and scope-freeze a bounded client-runtime foundation that safely coordinates pending-answer reconciliation before requesting the already-existing server-authoritative expiry-finalization operation.

This BU does not implement UI, a background scheduler, or a new timer.

## 2. Frozen Stage-2 Implementation Paths
1. `runtime/secure-assessment/src/client-expiry-finalization.ts`
2. `runtime/secure-assessment/test/client-expiry-finalization.test.ts`

## 3. Canonical Basis
Preserve:
* **D04.5-45:** Timer expiry requires a defined submission procedure.
* **D04.5-46:** At expiry, the client should attempt to flush pending responses where connectivity permits.
* **D04.5-47:** The server may finalize from the last authoritative accepted answers.
* **D04.5-48:** Local-only unsynced responses are an exception case and MUST NOT be falsely represented as server-received.
* **D04.5-49:** Expiry auto-finalization must remain idempotent.

Existing server-side expiry finalization from BU-016 provides:
* authorized Attempt validation;
* server-authoritative timer evaluation;
* Attempt FOR UPDATE serialization;
* rejection before expiry;
* idempotent Submission creation;
* stable existing receipt on retry.

Existing client answer reconciliation foundation: `reconcileClientAnswerQueue(...)` in `client-answer-reconciliation-queue.ts`.
Existing recovery scope/store: `client-answer-recovery-store.ts`.

BU-031 must compose these existing boundaries rather than duplicate them.

## 4. Substantive Target
Create an explicit client-side expiry-finalization coordination boundary invoked only after authoritative expiry has already been established by server-derived runtime state.

Required dependencies should be abstract/injected enough to test without network or UI:
* ClientAnswerRecoveryScope
* recovery store required by `reconcileClientAnswerQueue(...)`
* answer synchronization executor
* expiry-finalization executor

## 5. Required Semantics

1. **AUTHORITATIVE EXPIRY ONLY:** BU-031 must NOT derive expiry from `Date.now()`, device clock, or local countdown alone.
2. **RECONCILE BEFORE FINALIZE:** authoritative expiry observed → `reconcileClientAnswerQueue(...)` → inspect reconciliation result → only then decide whether server expiry-finalization may be requested.
3. **SUCCESSFUL RECONCILIATION GATE:** Server expiry-finalization may be invoked only when reconciliation completes without unresolved failed mutations (e.g. `summary.failed === 0` AND `summary.acknowledged === summary.attempted`). Already-acknowledged records represented by `skippedAcknowledged` remain valid.
4. **UNRESOLVED PENDING ANSWERS:** If reconciliation reports failures, DO NOT call expiry-finalization executor, DO NOT claim submitted, and return explicit state `pending_answers_unresolved`. Preserves D04.5-48.
5. **RECONCILIATION FAILURE:** If queue/store/reconciliation throws, DO NOT call expiry-finalization executor, DO NOT claim submitted, and return a conservative unresolved/recovery-required semantic state.
6. **FINALIZATION SUCCESS:** After successful reconciliation, invoke expiry-finalization executor exactly once. Only an explicit authoritative submitted receipt/result projects to `submitted`.
7. **FINALIZATION UNCERTAINTY:** If the finalization request throws/times out, DO NOT claim submitted or definitely not submitted. Return an honest state `finalization_uncertain`.
8. **NO LOCAL ANSWER DELETION:** BU-031 must not clear recovery scope, delete recovery records, or discard pending records.
9. **PURITY OF AUTHORITY:** Client orchestration must not create authoritative Submission locally, modify server timer truth, fabricate a receipt, or mutate canonical server answer state directly.
10. **NO BACKGROUND SCHEDULER:** No timer scheduler, cron, background task, polling service, or taskification. Callable runtime coordination primitive only.
11. **NO UI:** No React, frontend framework initialization, DOM, visual modal/banner, Indonesian copy, or student submitted screen.
12. **SEC-033 MATURITY:** Foundation toward SEC-033. Do NOT promote SEC-033 during this BU.

## 6. Frozen Result Semantics
At minimum support distinct outcomes equivalent to:
* `submitted`
* `pending_answers_unresolved`
* `finalization_uncertain`

## 7. Required Stage-2 Tests
1. All records already acknowledged → reconciliation safe → expiry finalizer called once → `submitted`
2. Pending mutation successfully reconciles → finalizer occurs only after reconciliation → `submitted`
3. One mutation reconciliation failure → `pending_answers_unresolved` → finalizer never called
4. Reconciliation/store throws → unresolved state → finalizer never called
5. Finalization executor throws/times out → `finalization_uncertain` → never falsely submitted
6. Finalization accepted → authoritative receipt propagated unchanged
7. No local recovery clear/delete occurs
8. No local/device-clock expiry calculation exists
9. Orchestration does not mutate supplied scope/input state

## 8. Non-Goals
Do not:
* modify BU-016;
* modify `client-answer-reconciliation-queue.ts`;
* modify `client-answer-reconciliation-retry.ts`;
* modify `client-answer-recovery-store.ts`;
* modify server `submission.ts`;
* modify `timer.ts`;
* build background auto-submit scheduler;
* define local-only-answer grace/recovery policy beyond canonical boundaries;
* clear local recovery records;
* build frontend/UI;
* select React/Vite/other frontend stack;
* modify Capability Matrix;
* promote SEC-033;
* close PB06/PB07;
* register/start BU-032;
* change LOCKED/FROZEN sources.

## 9. Current Stage
**Version:** 1.0.0
**Status:** COMPLETE / PRIOR CONTROLLER PHYSICAL AUDIT FAIL / FIRST TARGETED REMEDIATION COMPLETE / FIRST CONTROLLER PHYSICAL RE-AUDIT FAIL / SECOND TARGETED REMEDIATION COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PASS / FAST-TRACK LIFECYCLE CLOSE COMPLETE / FAST-TRACK REPOSITORY FINALIZED
**Artifact Type:** BUILD UNIT SPECIFICATION

## 10. Exit Semantics
COMPLETE / PRIOR CONTROLLER PHYSICAL AUDIT FAIL / FIRST TARGETED REMEDIATION COMPLETE / FIRST CONTROLLER PHYSICAL RE-AUDIT FAIL / SECOND TARGETED REMEDIATION COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PASS / FAST-TRACK LIFECYCLE CLOSE COMPLETE / FAST-TRACK REPOSITORY FINALIZED

PRIOR CONTROLLER PHYSICAL AUDIT:
FAIL

FIRST TARGETED REMEDIATION:
COMPLETE

FIRST CONTROLLER PHYSICAL RE-AUDIT:
FAIL

SECOND TARGETED REMEDIATION:
COMPLETE

CONTROLLER PHYSICAL RE-AUDIT:
PASS

FAST-TRACK LIFECYCLE CLOSE:
COMPLETE

DONE:
YES

FULL BU-031 REPOSITORY FINALIZED:
YES

FINAL PHYSICAL VERIFICATION:
NOT YET
