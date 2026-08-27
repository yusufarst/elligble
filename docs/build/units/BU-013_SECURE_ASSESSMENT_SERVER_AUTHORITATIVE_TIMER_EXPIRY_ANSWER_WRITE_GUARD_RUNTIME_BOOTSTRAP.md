# BU-013 Specification - Secure Assessment Server-Authoritative Timer Expiry & Answer Write Guard Runtime Bootstrap

**Status:** EXECUTED / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK PENDING AUDIT
**Version:** 1.0.0
**Phase:** BUILD
**Stage:** BU-013 FAST-TRACK MAIN EXECUTION

## 1. Purpose
Implement server-authoritative timer expiry and integrate it into the Answer Save transaction boundary to freeze answers when the timer runs out.

## 2. Server/Database Time Authority
Server/database time is the ONLY expiry authority. Client/device time must never influence expiry.

## 3. Timer GET Behavior
If the calculated `effectiveRemainingSeconds` is > 0, the timer status remains `active`.
If the calculated `effectiveRemainingSeconds` is <= 0, the timer status is `expired` and `effectiveRemainingSeconds` is clamped to 0.

## 4. Answer Save Integration
Answer Save evaluates authoritative timer expiry strictly inside its existing transaction (`FOR UPDATE` on Attempt) boundary.

## 5. Post-Expiry Behavior
After authoritative expiry:
- New Answer -> `409 {"error":"timer_expired"}`
- Mutating existing Answer -> `409 {"error":"timer_expired"}`
- New snapshot Answer -> `409 {"error":"timer_expired"}`
- Exact already-acknowledged same identity + same payload retry -> `200` same acknowledgement, ZERO mutation.

## 6. Adjustments
Timer adjustments correctly affect and extend/reduce the expiry calculation.

## 7. Submission Independence
Submission remains explicitly permitted; no auto-submit is implemented here. Expiry does not trigger Submission.

## 8. Exact out-of-scope
- Schema/migration changes
- Attempt status column/state machine
- Auto-submit or expiry-triggered Submission
- Answer flush
- Client reconciliation
- UI/frontend
- PB06/PB07 closure

## 9. Current Fast-Track lifecycle state

**Fast-Track:** ACTIVE / v1
**Implementation:** EXECUTED
**Typecheck:** PASS
**Test:** PASS
**Test Total:** 127
**Real PostgreSQL Verification:** PASS
**Expiry Guard:** PASS
**Exact Retry Zero Mutation:** PASS
**Timer Adjustment:** PASS
**Tenant Isolation:** PASS
**Controller Physical Audit:** NOT YET
**Done:** NO
**Full BU-013 Repository Finalized:** NO
**PB06:** OPEN
**PB07:** OPEN
