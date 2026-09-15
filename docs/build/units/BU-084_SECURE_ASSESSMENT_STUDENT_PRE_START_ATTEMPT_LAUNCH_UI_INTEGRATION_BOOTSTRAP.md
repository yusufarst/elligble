**Status:** ACTIVE / REMEDIATION
**Version:** 1.0.1
**Canonical:** CANONICAL BUILD UNIT RECORD
**Phase:** BUILD
**Build Unit:** BU-084
**Title:** Secure Assessment Student Pre-Start Attempt Launch UI Integration Bootstrap

## 1. Description
This Build Unit completes the integration of the `AttemptLaunch` UI component into the existing frontend application for Secure Assessment. It handles the pre-start lifecycle phase, resolving the necessary HTTP API interactions to transition a student from a pre-start state into the active workstation phase.

## 2. Requirements & Scope
- **IN SCOPE:** 
  - Complete the frontend implementation of `AttemptLaunch` component.
  - Fix any typescript errors and test issues related to it.
  - Validate state machine interactions (`pre_start`, `conflict`, `launched`).
  - Terminal verification (frontend typecheck, tests, build).
  - Use operational Indonesian copy only.
- **OUT OF SCOPE:** 
  - No new authentication implementation.
  - No assigned-exam discovery.
  - PB04/PB05 remain OPEN.

## 3. Implementation Plan
- Edit `frontend/web/src/components/AttemptLaunch.tsx` to fix TypeScript logic.
- Edit `frontend/web/src/__tests__/attemptLaunch.test.tsx` to fix `.toBeInTheDocument` matchers and mock object types.
- Ensure `npm run build` and `npm run test` pass.
- Record completion and update stage metadata.

## 4. Execution State
- **STAGE-1:** PASS / FROZEN
- **STAGE-2 IMPLEMENTATION:** COMPLETE / TARGETED REMEDIATION COMPLETE
- **ENGINEERING VERIFICATION:** PASS
- **RENDERED QA:** PASS
- **IMPLEMENTATION REPOSITORY FINALIZED:** YES
- **STAGE-3:** PENDING CONTROLLER RE-AUDIT
- **DONE:** NO
- **TERMINAL:** NO
