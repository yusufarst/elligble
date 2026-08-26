# BU-011: Secure Assessment Reconnect / Resume Authoritative State Readback Runtime Bootstrap

**Build Unit:** BU-011
**Title:** Secure Assessment Reconnect / Resume Authoritative State Readback Runtime Bootstrap
**Fast-Track:** ACTIVE / v1
**Implementation:** EXECUTED
**Typecheck:** PASS
**Test:** PASS (Total: 120)
**Terminal Verification:** PASS
**Real PostgreSQL Verification:** PASS
**Zero-Mutation Verification:** PASS
**Tenant Isolation:** PASS
**Coherent Snapshot:** REPEATABLE READ / READ ONLY / PASS
**Predecessor Regression:** PASS
**Initial Implementation Commit:** ec7b14eb31e6e51526969f3f7174a820a154d71a
**Forward Recovery Commit:** 2021e42854e7efebe87d0876de541486537c4ade
**Controller Physical Audit:** PASS
**Fast-Track Lifecycle Close:** COMPLETE
**Done:** YES
**Full BU-011 Repository Finalized:** YES
**PB06:** OPEN
**PB07:** OPEN

## 1. PURPOSE

Implement the smallest bounded server-side authoritative state readback needed for Secure Assessment reconnect/resume.

The capability allows an authorized client recovering after interruption to obtain authoritative server state for the SAME valid Exam Attempt.

This BU advances reconnect/resume and Zero-Lost-Answer architecture.
It does NOT complete end-to-end Zero Lost Answers.

PB06 remains OPEN.
PB07 remains OPEN.

## 2. CANONICAL INVARIANTS

Preserve:
- ZERO LOST ANSWERS
- RECONNECT != RETAKE
- Student != Exam Participant != Exam Attempt != Exam Session
- Question Bank Item != immutable Exam Question Snapshot
- Answer state remains Exam-Attempt-owned.
- Server-authoritative timer remains authoritative.
- Idempotent Submission remains authoritative.
- A submitted Attempt must not be represented as ambiguously active.

Reconnect must not:
- create a new Attempt;
- create a Retake;
- fabricate answers;
- fabricate authoritative state;
- bypass tenant/auth assessment context.

Teacher != Proctor.
Risk Signal != verdict.

## 3. PREDECESSORS

Consume existing accepted foundations:
- BU-002: Secure Assessment Attempt/core state
- BU-003: immutable Exam Question Snapshot persistence
- BU-004: authoritative Answer persistence
- BU-005: minimum Secure Assessment runtime
- BU-006: Answer Save / Acknowledgement runtime
- BU-007: server-authoritative Timer persistence
- BU-008: Timer Start / Remaining-Time runtime
- BU-009: idempotent Submission persistence
- BU-010: idempotent Submission runtime

Do not reopen any completed predecessor.

## 4. EXACT IN-SCOPE

Implement one bounded GET resume-state capability.

Local bounded route:
GET /api/v1/assessment/resume?attemptId=<uuid>

This is a BU-011-local runtime contract.
It is NOT a platform-wide API contract.

Required flow:
1. method validation;
2. attemptId UUID validation;
3. trusted AuthorizedAssessmentContext acquisition;
4. request attemptId must equal context.authorizedAttemptId;
5. acquire PostgreSQL connection;
6. verify Attempt exists inside context.tenantId;
7. perform coherent read-only authoritative state retrieval;
8. read authoritative Answer rows for tenant + Attempt;
9. read authoritative Timer state for tenant + Attempt;
10. read authoritative Submission state for tenant + Attempt;
11. return one bounded authoritative resume-state response;
12. release/rollback/commit cleanly as applicable.

No tenant authority from request/query.

## 5. AUTHORITATIVE RESPONSE

For an authorized existing Attempt return HTTP 200 with this bounded shape:

```json
{
  "attemptId": "<authorized attempt UUID>",
  "answers": [
    {
      "snapshotId": "<immutable snapshot UUID>",
      "answerPayload": <authoritative persisted JSON>,
      "clientWriteIdentity": "<persisted identity or null>",
      "writeVersion": <persisted integer>,
      "updatedAt": "<authoritative persisted timestamp>"
    }
  ],
  "timer": {
    ...
  },
  "submission": {
    ...
  }
}
```

ANSWERS:
- derived only from secure_assessment_exam_answers;
- tenant + Attempt scoped;
- empty array is valid;
- deterministic ordering required;
- no locally pending answer may be invented.

TIMER:
If authoritative timer row exists but has not started:
```json
{
  "status": "not_started"
}
```

If started:
```json
{
  "status": "active",
  "startedAt": "<server persisted timestamp>",
  "configuredDurationSeconds": <n>,
  "effectiveDurationSeconds": <n>,
  "effectiveRemainingSeconds": <n>
}
```

Remaining time must use server/database authority.
Client clock is never authoritative.

If required timer state does not exist:
return bounded assessment_context_not_found behavior.

SUBMISSION:
If no authoritative Submission:
```json
{
  "status": "not_submitted"
}
```

If authoritative Submission exists:
```json
{
  "status": "submitted",
  "submissionId": "<persisted id>",
  "submittedAt": "<persisted submitted_at>"
}
```

These are response metadata only.
DO NOT add an Exam Attempt status state machine.

## 6. STRICT READ-ONLY RESUME SEMANTICS

The resume endpoint itself must NOT:
- INSERT Answer;
- UPDATE Answer;
- start Timer;
- adjust Timer;
- create Submission;
- create Exam Attempt;
- create Exam Session;
- create Retake;
- mutate question snapshots.

It is authoritative READBACK only.
If a coherent DB transaction is used, keep it read-only and bounded.

## 7. ERROR SEMANTICS

Required bounded behavior:

invalid/missing attemptId:
400
{"error":"invalid_request"}

missing trusted context:
403
{"error":"forbidden"}

attempt mismatch:
403
{"error":"forbidden"}

nonexistent/inaccessible Attempt:
404
{"error":"assessment_context_not_found"}

unsupported method:
405
{"error":"method_not_allowed"}

persistence unavailable:
503
{"error":"persistence_unavailable"}

unexpected bounded non-persistence failure:
500
{"error":"internal_error"}

Do not leak database internals.

## 8. EXACT OUT-OF-SCOPE

DO NOT implement:
- client-side pending-answer reconciliation
- client local recovery buffer
- IndexedDB
- localStorage decision
- offline queue
- offline-first orchestration
- automatic network retry
- automatic pending-write resend
- merge/conflict UI
- frontend/mobile UI
- device-transfer recovery
- new Exam Session persistence
- Session replacement policy
- Retake creation
- timer expiry enforcement
- expiry transition
- auto-submit
- answer flush at expiry
- grace period
- pause/resume timer policy
- scoring
- grading
- results
- proctoring
- Violation Event
- Risk Signal
- Incident
- Cheating Decision
- Essential Security expansion
- PB06 closure
- PB07 closure
- global API design
- global stack selection
- platform-wide ERD

## 9. DATABASE BOUNDARY

NEW SCHEMA: NOT AUTHORIZED
NEW MIGRATION: NOT AUTHORIZED
Use existing migrations 0001 through 0006.

Do NOT create migration 0007 in this BU.
