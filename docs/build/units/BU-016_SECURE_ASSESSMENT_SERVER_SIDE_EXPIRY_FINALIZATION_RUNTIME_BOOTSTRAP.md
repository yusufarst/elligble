# BU-016 Specification - Secure Assessment Server-Side Expiry Finalization Runtime Bootstrap

**Status:** COMPLETE / TERMINAL VERIFICATION PASS /
REAL POSTGRESQL VERIFICATION PASS /
CONTROLLER PHYSICAL AUDIT PASS /
FAST-TRACK REPOSITORY FINALIZED
**Version:** 1.0.0
**Phase:** BUILD
**Stage:** BU-016 FAST-TRACK LIFECYCLE CLOSE

**Controller Physical Audit:** PASS
**Fast-Track Lifecycle Close:** COMPLETE
**Done:** YES
**Full BU-016 Repository Finalized:** YES
**PB06:** OPEN / NOT READY FOR CLOSURE
**PB07:** OPEN

## 1. Purpose
Implement the bounded SERVER-SIDE portion of the canonical expiry finalization procedure.
This BU provides an authoritative server operation that can finalize an expired Attempt from its last server-accepted authoritative Answer state.
It does NOT implement client pending-answer flush, local recovery queue, offline reconciliation, frontend timer behavior, or a background scheduler.

## 2. Canonical Basis
- Discovery D04.5-45: Timer expiry must trigger a defined Submission procedure.
- Discovery D04.5-46: Client should attempt to flush pending responses where connectivity permits.
- Discovery D04.5-47: Server can finalize from last server-accepted authoritative answer state.
- Discovery D04.5-49: Expiry finalization logic.
- SEC-033: (BU-015 derived capability-matrix row, NOT an Architecture section) Expiry finalizes gracefully.

## 3. Scope
- `POST /api/v1/assessment/expiry-finalize` endpoint.
- Validates token against Attempt.
- The tenant-bound Attempt row is locked FOR UPDATE.
- After that lock:
  - existing Submission is checked;
  - authoritative timer state + adjustment ledger are read;
  - expiry uses `statement_timestamp()`.
- Rejects `409 timer_not_expired` if remaining time > 0.
- Otherwise, inserts into `secure_assessment_exam_submissions`.
- Handles concurrency explicitly converging to exactly one Submission row.
- After expiry finalization, further updates return `409 attempt_already_submitted`.
- Exact retries of previously acknowledged answers return `200` without mutation.
- Resume endpoint reports `submitted` with the exact receipt.
- Tenant isolation and server-authoritative clock enforced.

## 3.1. Maturity Statement
BU-016 implements SERVER-SIDE expiry finalization only.

It does NOT prove:
- client pending-answer flush;
- offline queue;
- local-first recovery/reconciliation;
- background/scheduler-driven auto-submit.

## 4. Verification
This unit provides real PostgreSQL integration tests through a disposable harness, covering timer expiration transitions, idempotent retries, race conditions, and tenant isolation, ensuring zero mutation of state upon exact retries and preventing multiple submissions.
