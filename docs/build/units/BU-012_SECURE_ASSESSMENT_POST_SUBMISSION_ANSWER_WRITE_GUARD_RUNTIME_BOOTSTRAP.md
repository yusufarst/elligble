# BU-012 Specification - Secure Assessment Post-Submission Answer Write Guard Runtime Bootstrap

**Status:** PENDING CONTROLLER PHYSICAL AUDIT
**Version:** 1.0.0
**Phase:** BUILD
**Stage:** FAST-TRACK PENDING AUDIT

## 1. Purpose
Close the runtime integrity gap between authoritative Answer Save and final Submission.

## 2. Canonical invariants
After an authoritative final Submission exists for an Exam Attempt:
- no new Answer may be inserted;
- no existing Answer may be changed;
- no write_version may advance;
- no answer payload may change.

## 3. Predecessors
- BU-010 Idempotent Submission Runtime Bootstrap
- BU-011 Reconnect/Resume Authoritative State Readback Runtime Bootstrap

## 4. Shared tenant-bound Attempt FOR UPDATE serialization boundary
Both Answer Save and Submission must acquire the tenant-bound `secure_assessment_exam_attempts` row `FOR UPDATE` before proceeding to mutate answers or create submissions.

## 5. Answer Save ordering
Answer Save locks the attempt, checks for an existing submission, and if not present, proceeds to process the answer logic.

## 6. Submission ordering
Submission locks the attempt and creates the submission receipt. Since both Answer Save and Submission lock the attempt, they are strictly serialized.

## 7. Answer-first race semantics
If Answer Save acquires the lock first, the answer is processed and persisted. Submission waits and then successfully marks the attempt submitted.

## 8. Submission-first race semantics
If Submission acquires the lock first, it completes. Answer Save then acquires the lock, detects the submission, and returns `409 attempt_already_submitted`. The answer state remains unchanged.

## 9. Exact acknowledged retry after Submission
If an identical retry (same identity, payload, timestamp) arrives after Submission, it is recognized and acknowledged safely (returns 200) without mutating state.

## 10. Post-Submission mutation rejection
Any new write or update to an answer after submission is strictly rejected with `409 attempt_already_submitted`.

## 11. Concurrent post-Submission guarantee
Even under high concurrency (e.g. 16+ simultaneous requests), post-submission mutating callers are strictly rejected due to the shared serialization boundary.

## 12. Error semantics
Post-submission attempts to mutate answers return `409 attempt_already_submitted`. Missing or inaccessible attempts return `404 assessment_context_not_found`. Context errors return `403 forbidden`.

## 13. Tenant isolation
Cross-tenant writes are strictly prevented. The `tenant_id` must match both the context and the database row during the `FOR UPDATE` read.

## 14. No schema / no migration boundary
This implementation operates entirely within the runtime and does not introduce any new schema migrations (uses existing `0001` through `0006`).

## 15. Exact out-of-scope
- Asynchronous grading/scoring
- Reporting and analytics
- Cross-region multi-primary replication
- Real-time websocket notification of submission

## 16. Required test matrix
Must cover missing context, missing payload, malformed JSON, answer save capability tests, resume tests, server tests, submission tests, timer capability tests. 124 exact tests total.

## 17. Real PostgreSQL verification requirements/results
Must verify Race A (Answer-First), Race B (Submission-First), Concurrent Post-Submission writes, Exact Acknowledged Retry Zero Mutation, Tenant Isolation, and DB Cleanup.
Result: PASS

## 18. Process/evidence history
Due to a premature documentation sync and spec, the Controller mandated a Fast-Track Stage 2 and Local Pre-Audit Recovery Forensic Audit to restore the correct pre-audit state without rebasing or amending commits.

## 19. Commit lineage
- Implementation Commit: ca4c6fbd1d8adec649bc6b0a40780616eaa15185
- Premature Documentation Sync Commit: 88f3628f444de933bbc02157d471f0a5222c7ed4
- Premature Spec Commit: 1cbca4357caef981004d4b266577b10f5b27aff8
- First Local Pre-Audit Recovery Commit: 4857ec298e2ae162776eefbc3232db2b600467f7

## 20. Current Fast-Track lifecycle state

**Fast-Track:** ACTIVE / v1
**Implementation:** EXECUTED
**Typecheck:** PASS
**Test:** PASS
**Test Total:** 124
**Real PostgreSQL Verification:** PASS
**Answer / Submission Serialization:** PASS
**Post-Submission Answer Freeze:** PASS
**Race A Answer-First:** PASS
**Race B Submission-First:** PASS
**Concurrent Post-Submission Writes:** PASS
**Exact Acknowledged Retry Zero Mutation:** PASS
**Tenant Isolation:** PASS
**Predecessor Regression:** PASS
**Implementation Commit:** ca4c6fbd1d8adec649bc6b0a40780616eaa15185
**Premature Documentation Sync Commit:** 88f3628f444de933bbc02157d471f0a5222c7ed4
**Premature Spec Commit:** 1cbca4357caef981004d4b266577b10f5b27aff8
**First Local Pre-Audit Recovery Commit:** 4857ec298e2ae162776eefbc3232db2b600467f7
**Controller Physical Audit:** NOT YET
**Done:** NO
**Full BU-012 Repository Finalized:** NO
**PB06:** OPEN
**PB07:** OPEN
