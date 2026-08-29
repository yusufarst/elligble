# BU-028: Secure Assessment Client Answer Immediate Autosave Capture Runtime Foundation Bootstrap

## 1. Goal
Freeze the small runtime layer that converts a student answer change into durable local pending state and immediately hands synchronization to the already-completed BU-025/026 reconciliation/retry chain.

## 2. Frozen Stage-2 Implementation Paths
1. `runtime/secure-assessment/src/client-answer-autosave.ts`
2. `runtime/secure-assessment/test/client-answer-autosave.test.ts`

## 3. Frozen Stage-2 Semantics
1. Reuse BU-022 `createPendingMutation`; do not duplicate sync-state logic.
2. Reuse BU-023 `createRecoveryRecord` and `ClientAnswerRecoveryStore`.
3. Autosave input must preserve canonical answer mutation identity:
   * tenantId
   * participantId
   * examInstanceId
   * attemptId
   * snapshotId
   * localSequence
   * clientWriteIdentity
   * expectedWriteVersion
   * answerPayload
4. On answer change:
   create pending mutation
   → create recovery record
   → persist durable recovery record
   → only after successful local persistence request synchronization.
5. Durable local persistence MUST complete before synchronization trigger is invoked.
6. For current baseline PG A–E selection, capture is immediate. No debounce/timer policy is required in BU-028.
7. Synchronization must use an injected trigger boundary compatible with the existing reconciliation/retry runtime. Do not duplicate BU-025 reconciliation or BU-026 retry logic.
8. Successful local capture remains `pending`. It MUST NOT claim authoritative `SAVED`, `acknowledged`, or invent `acceptedWriteVersion`.
9. If local persistence fails:
   * autosave operation fails/rejects;
   * synchronization trigger is not invoked;
   * no false authoritative save state is created.
10. Caller may continue after durable local capture succeeds; autosave must not wait for a server network round trip.
11. Preserve localSequence/clientWriteIdentity/idempotent mutation identity exactly.
12. No direct authoritative acknowledgement mutation in BU-028.

## 4. Stage-2 Focused Tests Must Cover
* valid answer change creates pending mutation;
* identity/payload/version fields preserved;
* durable store put occurs before sync trigger;
* successful local capture triggers synchronization exactly once;
* local persistence failure triggers no synchronization;
* local persistence failure is surfaced;
* captured result remains pending/not acknowledged;
* invalid mutation input performs no durable write/trigger;
* sequential answer changes preserve localSequence distinction;
* no server/network round-trip required to finish local capture.

## 5. Non-Goals
Do not:
* implement React/Vue/UI;
* implement SEC-011 visible save-state UI;
* implement SEC-012 UI verification;
* add fetch/HTTP transport;
* add browser `online` listener;
* add Service Worker;
* add debounce/periodic timer policy;
* change BU-025/026 runtime semantics;
* modify Capability Matrix;
* close PB06/PB07;
* claim SEC-010 PROVEN yet;
* start/register BU-029.

## 6. Current Stage
**Version:** 1.0.0
**Status:** COMPLETE / CONTROLLER PHYSICAL RE-AUDIT PASS / FAST-TRACK LIFECYCLE CLOSE COMPLETE / FAST-TRACK REPOSITORY FINALIZED
**Artifact Type:** BUILD UNIT SPECIFICATION

## 7. Exit Semantics
COMPLETE /
CONTROLLER PHYSICAL RE-AUDIT PASS /
FAST-TRACK LIFECYCLE CLOSE COMPLETE /
FAST-TRACK REPOSITORY FINALIZED

DONE:
YES
