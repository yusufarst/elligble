# BU-030 Secure Assessment Client Answer Honest Save-State Projection Runtime Foundation Bootstrap

**Status:** FAST-TRACK MAIN EXECUTION COMPLETE / IMPLEMENTATION REPOSITORY FINALIZED / PRIOR CONTROLLER PHYSICAL AUDIT FAIL / TARGETED REMEDIATION COMPLETE / AWAITING CONTROLLER PHYSICAL RE-AUDIT
**Version:** 1.0.0
**Source:** Canonical Discovery (D04.01)

## 1. Description
Register and scope-freeze a bounded runtime-foundation unit that derives honest participant-facing save-state semantics from already-existing client answer synchronization state. This unit must prepare SEC-011 / SEC-012 implementation without implementing actual frontend rendering.

## 2. Frozen Stage-2 Implementation Paths
1. `runtime/secure-assessment/src/client-answer-save-state.ts`
2. `runtime/secure-assessment/test/client-answer-save-state.test.ts`

## 3. Frozen Canonical Basis
Discovery D04.5-12 requires honest visible save semantics covering:
* SAVED
* SAVING / SYNCING
* OFFLINE / PENDING
* SAVE FAILED / NEEDS ATTENTION

Discovery D04.5-13 requires:
"Saved" only when the corresponding answer is authoritatively accepted.

Architecture requires locally pending state and server-acknowledged state to remain distinct and derived client/UI state must not overwrite canonical assessment truth.

Existing runtime authority:
`runtime/secure-assessment/src/client-answer-sync.ts`
provides:
`pending`, `in_flight`, `acknowledged`, `failed`
plus:
`acceptedWriteVersion`
and:
`isMutationAcknowledged(...)`

## 4. Frozen Stage-2 Substantive Target
Create a pure save-state projection boundary.
Required semantic projection states:
`saved`, `saving`, `pending`, `offline`, `save_failed`

The implementation must consume:
* ClientAnswerMutationRecord
* an explicit connectivity input sufficient to distinguish offline from non-offline state

Do not infer offline merely because a mutation is pending or failed.

REQUIRED RULES
1. `saved` may be returned ONLY when authoritative acknowledgement is proven:
   * syncState = acknowledged
   * acceptedWriteVersion is non-null / valid
   * use or preserve semantics equivalent to isMutationAcknowledged(...)
2. `in_flight` while not explicitly offline projects to: `saving`
3. locally durable `pending` while not explicitly offline projects to: `pending`
4. pending/in-flight state with explicit offline connectivity may project to: `offline`
5. `failed` projects to: `save_failed`
6. pending, in-flight, offline, or failed state MUST NEVER project to: `saved`
7. an inconsistent record that claims acknowledged without a valid acceptedWriteVersion MUST NOT project to: `saved`
8. projection is derived client state only:
   * must not mutate ClientAnswerMutationRecord
   * must not write recovery storage
   * must not trigger network synchronization
   * must not modify authoritative server state
9. no Indonesian/UI copy in this unit. Stage-2 produces semantic runtime projection, not visual components.

## 5. Required Stage-2 Verification
Focused tests must cover at minimum:
* authoritative acknowledgement → saved
* in-flight online/non-offline → saving
* pending online/non-offline → pending
* pending explicit offline → offline
* in-flight explicit offline → offline
* failed → save_failed
* acknowledged without acceptedWriteVersion never → saved
* no mutation of input record

## 6. Current Stage
**Version:** 1.0.0
**Status:** FAST-TRACK MAIN EXECUTION COMPLETE / IMPLEMENTATION REPOSITORY FINALIZED / PRIOR CONTROLLER PHYSICAL AUDIT FAIL / TARGETED REMEDIATION COMPLETE / AWAITING CONTROLLER PHYSICAL RE-AUDIT
**Artifact Type:** BUILD UNIT SPECIFICATION

## 7. Exit Semantics
FAST-TRACK MAIN EXECUTION COMPLETE /
IMPLEMENTATION REPOSITORY FINALIZED /
PRIOR CONTROLLER PHYSICAL AUDIT FAIL /
TARGETED REMEDIATION COMPLETE /
AWAITING CONTROLLER PHYSICAL RE-AUDIT

PRIOR CONTROLLER PHYSICAL AUDIT:
FAIL

CONTROLLER PHYSICAL RE-AUDIT:
NOT YET

FAST-TRACK LIFECYCLE CLOSE:
NOT YET

DONE:
NO
