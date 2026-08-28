# BU-019: Secure Assessment Active-Session Answer Write Authority Guard Runtime Bootstrap

**Version:** 1.0.0
**STATUS:** ACTIVE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK MAIN EXECUTION
**Stage:** BU-019 FAST-TRACK MAIN EXECUTION
**Controller Physical Audit:** NOT YET
**Done:** NO
**Full BU-019 Repository Finalized:** NO
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
- [ ] Controller Physical Audit
- [ ] Fast-Track Lifecycle Close

## Explicit maturity

SEC-005:
BU-017 + BU-018 IMPLEMENTATION EVIDENCE CONTROLLER-PROVEN /
CAPABILITY MATRIX SYNCHRONIZATION PENDING

SEC-028:
IMPLEMENTATION PARTIAL /
ANSWER-WRITE AUTHORITY ENFORCEMENT CANDIDATE /
NOT YET FULLY PROVEN

Reason:
Resume authoritative active-Session readback remains outside BU-019.

PB06:
OPEN / NOT READY FOR CLOSURE

PB07:
OPEN
