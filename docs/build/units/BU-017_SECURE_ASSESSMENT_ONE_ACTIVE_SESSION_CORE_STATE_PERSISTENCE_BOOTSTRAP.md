# BU-017 Specification - Secure Assessment One-Active-Session Core State Persistence Bootstrap

**Status:** ACTIVE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK MAIN EXECUTION
**Version:** 1.0.0
**Phase:** BUILD
**Stage:** BU-017 FAST-TRACK MAIN EXECUTION

**Controller Physical Audit:** NOT YET
**Done:** NO
**Full BU-017 Repository Finalized:** NO
**PB06:** OPEN / NOT READY FOR CLOSURE
**PB07:** OPEN

## 1. Purpose
Implement the smallest persistence-level foundation required for:
- one active Exam Session per Exam Attempt;
- preserved historical/superseded Session records;
- governed Session replacement without replacing the Exam Attempt;
- later reconnect/device-transfer/session-supersession runtime.

This BU is PERSISTENCE ONLY. It does NOT implement runtime session activation, runtime session supersession, reconnect orchestration, device-transfer API, frontend, local recovery queue, autosave, anti-cheating, or PB06/PB07 closure.

## 2. Canonical Basis
- **Discovery D04.1-10:** Exam Attempt != Exam Session.
- **Discovery D04.1-11:** one Attempt may experience multiple technical Sessions.
- **Discovery D04.1-13:** Session recovery does not create a Retake.
- **Discovery D04.1-42:** one active Exam Session is the baseline policy.
- **Discovery D04.1-43:** a governed confirmed second active Session supersedes the first.
- **Discovery D04.1-44:** superseded Session answers/history must not be silently deleted.
- **Architecture §4:** Attempt is not Session; Session loss does not inherently terminate/replace Attempt.
- **Architecture §8:** Session lifecycle may change without silently replacing Attempt lifecycle.
- **Architecture §10:** Secure Assessment owns authoritative Exam Session state.

## 3. Maturity Statement
BU-017 establishes persistence foundation only.
It does NOT yet prove full:
- SEC-005
- SEC-028
because runtime activation/governed supersession is not implemented here.

## 4. Required Persistence Semantics
1. Existing Session rows remain valid and preserved.
2. A historical Session may exist without being active.
3. Add `activated_at` (nullable).
4. Add `ended_at` (nullable).
5. Add `superseded_by_session_id` (nullable).
6. Tenant-bound same-domain referential integrity for `superseded_by_session_id`.
7. ACTIVE = `activated_at IS NOT NULL AND ended_at IS NULL`.
8. Enforce ONE active Session per `tenant_id` + `exam_attempt_id` using partial unique index.
9. Multiple non-active Sessions per Attempt allowed.
10. Active Sessions for different Attempts allowed.
11. Old Session remains physically.
12. Prevent self-supersession (`superseded_by_session_id != id`).
13. Preserve BU-002 tenant-bound Attempt relationship.
14. No general Exam Attempt lifecycle state machine.
15. No ACTIVE/SUBMITTED/ENDED Attempt status columns.
