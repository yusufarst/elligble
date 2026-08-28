# BU-019: Secure Assessment Active-Session Answer Write Authority Guard Runtime Bootstrap

**Version:** 1.0.0
**STATUS:** COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / CONTROLLER PHYSICAL AUDIT PASS / FAST-TRACK REPOSITORY FINALIZED
**Stage:** BU-019 FAST-TRACK LIFECYCLE CLOSE
**Controller Physical Audit:** PASS
**Fast-Track Lifecycle Close:** COMPLETE
**Done:** YES
**Full BU-019 Repository Finalized:** YES
**OWNER:** Yusuf Setiawan
**LAST UPDATED:** 2026-08-28

## Purpose
Implement the smallest authoritative runtime enforcement that prevents an ended, superseded, foreign, nonexistent, or otherwise non-active Exam Session from continuing Answer writes for an Exam Attempt.

This BU builds directly on:
- BU-017: one-active-session persistence invariant
- BU-018: governed Session activation/supersession runtime

BU-019 is Answer-write enforcement only.

## Checklist
- [x] Enforce missing sessionId 400 rejection
- [x] Enforce missing attemptId 400 rejection
- [x] Enforce UUID malformed 400 rejection
- [x] Lock active Attempt FOR UPDATE
- [x] Query authoritative active Session via attempt_id + tenant_id
- [x] Reject write with 409 `session_not_active` if mismatched/non-active
- [x] Process authorized write conditionally on valid active Session
- [x] Return generic `session_not_active` error without active Session UUID
- [x] Verify real PostgreSQL execution
- [x] Main execution verification complete
- [x] Controller Physical Audit
- [x] Fast-Track Lifecycle Close

BU-019 proves active-Session authority enforcement for Answer writes.

BU-019 does NOT implement:
- Resume authoritative active-Session readback;
- controlled device-transfer UX;
- local recovery queue;
- autosave;
- frontend;
- capability-matrix synchronization.

## Explicit maturity

SEC-005:
BU-017 + BU-018 IMPLEMENTATION EVIDENCE CONTROLLER-PROVEN /
CAPABILITY MATRIX SYNCHRONIZATION PENDING

SEC-028:
BU-019 ANSWER-WRITE AUTHORITY ENFORCEMENT CONTROLLER-PROVEN /
IMPLEMENTATION PARTIAL /
NOT YET FULLY PROVEN

Reason:
Resume authoritative active-Session readback remains absent.

PB06:
OPEN / NOT READY FOR CLOSURE

PB07:
OPEN
