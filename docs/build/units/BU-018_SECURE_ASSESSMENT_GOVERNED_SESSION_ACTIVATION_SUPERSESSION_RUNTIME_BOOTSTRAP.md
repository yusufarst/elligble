# BU-018 Specification - Secure Assessment Governed Session Activation / Supersession Runtime Bootstrap

**Status:** COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / CONTROLLER PHYSICAL AUDIT PASS / FAST-TRACK REPOSITORY FINALIZED
**Version:** 1.0.0
**Phase:** BUILD
**Stage:** BU-018 FAST-TRACK LIFECYCLE CLOSE

**Controller Physical Audit:** PASS
**Fast-Track Lifecycle Close:** COMPLETE
**Done:** YES
**Full BU-018 Repository Finalized:** YES
**PB06:** OPEN / NOT READY FOR CLOSURE
**PB07:** OPEN

## 1. Purpose
Implement the smallest authoritative runtime required to:
- activate the first technical Exam Session for an Exam Attempt;
- detect an already-active different Session;
- require explicit confirmed supersession;
- safely supersede the active Session while preserving the same Exam Attempt;
- preserve old Session history;
- serialize concurrent Session activation/supersession decisions.

THIS BU IS SESSION TRANSITION RUNTIME ONLY.
It does NOT implement:
- Answer active-session write guard;
- superseded-Session Answer rejection;
- Resume active-session readback;
- device fingerprint/device identity;
- full controlled-device-transfer UX;
- Proctor override workflow;
- client local recovery;
- autosave;
- frontend;
- PB06/PB07 closure.

## 2. Canonical Basis
- **Discovery D04.1-10:** Exam Attempt != Exam Session.
- **Discovery D04.1-11:** one Attempt may have multiple technical Sessions.
- **Discovery D04.1-13:** Session recovery != Retake.
- **Discovery D04.1-42 / D04.4-32:** one active Exam Session per Attempt is baseline.
- **Discovery D04.1-43 / D04.4-35:** a second active Session requires a governed decision.
- **Discovery D04.4-36:** confirmed takeover supersedes the old Session.
- **Discovery D04.4-37:** superseded Session must not continue authoritative scoring writes (out of scope for BU-018).
- **Discovery D04.4-39:** controlled device transfer remains governed.
- **Architecture §4:** Attempt and Session are distinct.
- **Architecture §8:** Session lifecycle may change without silently replacing Attempt lifecycle.
- **Architecture §10:** Secure Assessment owns authoritative Exam Session state.

## 3. Maturity Statement
After successful BU-018 main execution:
- **SEC-005:** BU-017 + BU-018 IMPLEMENTATION EVIDENCE CONTROLLER-PROVEN / CAPABILITY MATRIX SYNCHRONIZATION PENDING
- **SEC-028:** NOT YET FULLY PROVEN

## 4. Contract
- Request: `POST /api/v1/assessment/session/activate`
- Require: `attemptId` (UUID), `sessionId` (UUID).
- Optional: `confirmSupersede` (boolean, default false), `expectedActiveSessionId` (UUID, required when `confirmSupersede` is true).
- Must serialize on Attempt `FOR UPDATE`.
- Active state defined by `activated_at IS NOT NULL AND ended_at IS NULL`.
- Successful transition marks old session `ended_at = transition_timestamp`, `superseded_by_session_id = new_session_id`. New session sets `activated_at = transition_timestamp`.
- Zero mutation on identical idempotent retries.
- 409 `active_session_exists` on unconfirmed activation attempts when an active session exists.
- 409 `active_session_changed` on stale confirm attempts.
- 409 `attempt_already_submitted` on attempts after submission.
