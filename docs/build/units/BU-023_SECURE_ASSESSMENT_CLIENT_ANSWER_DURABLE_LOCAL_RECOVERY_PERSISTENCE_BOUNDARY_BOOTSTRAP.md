# BU-023 — Secure Assessment Client Answer Durable Local Recovery Persistence Boundary Bootstrap

**Version:** 1.0.0
**Phase:** BUILD
**Fast-Track Stage:** Stage 2

## 1. Purpose
BU-023 establishes the next bounded foundation required by Secure Assessment Zero-Lost-Answer continuity by defining a framework-agnostic, deterministic TypeScript client-side synchronization-state local recovery persistence boundary. It provides strongly scoped attempt-level recovery records, deterministic collision-safe keys, and a mechanism-neutral persistence-store contract.

## 2. Canonical Basis
* docs/01-discovery/04.01_SECURE_ASSESSMENT.md
* docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md
* docs/architecture/RUNTIME_RELIABILITY_AND_OPERATIONS_ARCHITECTURE.md

## 3. Predecessor Dependencies
* BU-004
* BU-006
* BU-014
* BU-015
* BU-019
* BU-020
* BU-022

## 4. Exact Implementation Paths
* `docs/build/units/BU-023_SECURE_ASSESSMENT_CLIENT_ANSWER_DURABLE_LOCAL_RECOVERY_PERSISTENCE_BOUNDARY_BOOTSTRAP.md`
* `runtime/secure-assessment/src/client-answer-recovery-store.ts`
* `runtime/secure-assessment/test/client-answer-recovery-store.test.ts`
* `docs/build/BUILD_PHASE_INDEX.md`
* `docs/DOCUMENT_MANIFEST.md`
* `docs/state/CURRENT_STATE.md`
* `docs/state/HANDOFF_PACKET.md`

## 5. Recovery Scope Contract
Exports `ClientAnswerRecoveryScope` mapping `tenantId`, `participantId`, `examInstanceId`, and `attemptId` strictly as non-empty strings. `buildRecoveryScopeKey` generates a deterministic JSON tuple string key distinguishing all four dimensions safely, refusing delimiter concatenation.

## 6. Recovery Record Identity Contract
Exports `ClientAnswerRecoveryRecord` tying a deterministic `recordKey` and `scopeKey` to a `ClientAnswerMutationRecord`. `buildRecoveryRecordKey` guarantees collision-free uniqueness across the five sync dimensions plus `localSequence` and `clientWriteIdentity`. `createRecoveryRecord` perfectly preserves all sync/payload properties without mutating status.

## 7. Persistence Store Boundary
Exports `ClientAnswerRecoveryStore` as a mechanism-neutral TypeScript interface with async methods: `put`, `get`, `listByScope`, `delete`, and `clearScope`. This contract dictates operations without imposing side effects.

## 8. Behavioral Requirements
* Keys must employ structured JSON stringification to defend against adversarial delimiter collisions.
* Recovered record keys distinguish responses at the level of specific client sequence numbers.
* Mapping a mutation to a recovery record MUST NOT falsely progress its `syncState` or falsely construct an `acceptedWriteVersion`.
* Scope verification must enforce exactly four identical properties, enforcing `tenantId` mismatch resistance.

## 9. Verification Requirements
* Deterministic scope/record key logic.
* Adversarial delimiter collision guarantees.
* Accurate dimension mapping and state preservation inside `createRecoveryRecord`.
* Correct isolation behavior for `isRecoveryRecordForScope`.
* Pure execution yielding zero direct storage or framework side effects.

## 10. Explicit Non-Goals
* Concrete browser implementation (IndexedDB, localStorage).
* Autosave interval/retry engines.
* Framework hooks or components (React, Vue).
* End-to-End zero-lost-answer closure.
* PB06/PB07 closure.

## 11. Capability Maturity Statement
SEC-010 AUTOSAVE: NOT YET FULLY IMPLEMENTED
SEC-011 VISIBLE SAVE STATES: NOT YET FULLY IMPLEMENTED
SEC-012 CLIENT MUST NOT FALSELY CLAIM SAVED: FOUNDATION ESTABLISHED / NOT YET FULLY PROVEN
SEC-013 DURABLE LOCAL-FIRST RECOVERY BUFFER: PERSISTENCE BOUNDARY FOUNDATION ESTABLISHED / NOT YET FULLY IMPLEMENTED
SEC-014 PENDING QUEUE / RETRY / RE-SYNC: NOT YET FULLY IMPLEMENTED
SEC-031 ZERO LOST ANSWERS E2E: NOT YET FULLY IMPLEMENTED

## 12. PB06/PB07 Preservation
PB06: OPEN / NOT READY FOR CLOSURE
PB07: OPEN

## 13. Capability Matrix Preservation
Matrix remains:
PROVEN: 19
IMPLEMENTED / EVIDENCE GAP: 0
NOT YET IMPLEMENTED: 13
PROVISIONAL: 1
FUTURE: 1
NOT APPLICABLE: 0
TOTAL: 34

## 14. Controller Audit / Remediation

PRIOR STAGE-3 CONTROLLER PHYSICAL AUDIT:
FAIL

Defects:
* stale Manifest Build Index registration;
* stale current Handoff navigation;
* missing explicit pending/failed/non-null acknowledged preservation evidence;
* predecessor buildSyncKey reuse mismatch;
* stale typecheck evidence after final implementation edits;
* historical controlled-Git/process defects.

History is preserved and remediation is forward-only.

## 15. Final Stage-2 Exit Semantics
FAST-TRACK MAIN EXECUTION REMEDIATION COMPLETE /
IMPLEMENTATION REPOSITORY FINALIZED /
AWAITING CONTROLLER PHYSICAL RE-AUDIT

PRIOR CONTROLLER PHYSICAL AUDIT:
FAIL

CONTROLLER PHYSICAL RE-AUDIT:
NOT YET

FAST-TRACK LIFECYCLE CLOSE:
NOT YET

DONE:
NO

FULL BU-023 REPOSITORY FINALIZED:
NO
