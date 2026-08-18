# SECURE ASSESSMENT CRITICAL ARCHITECTURE

Status:
LOCKED

Version:
1.0.0

Artifact Type:
ARCHITECTURE

Canonical:
YES

Architecture Sequence:
SEQUENCE 4 - SECURE ASSESSMENT CRITICAL ARCHITECTURE

Unit ID:
NONE

Architecture Unit Naming Convention:
NOT YET ESTABLISHED

Build:
NOT AUTHORIZED

## 1. PURPOSE / AUTHORITY / SCOPE

Secure Assessment is mission-critical.
This artifact consumes finalized Sequence 1/2/3 inputs without reopening them.
It defines Architecture HOW-level guarantees but does not choose implementation technology.
It does not itself close Production Blockers or authorize Build.

## 2. CANONICAL SECURE ASSESSMENT INVARIANTS

The following invariants are explicitly preserved:
- ZERO LOST ANSWERS
- Server-Authoritative Timer
- Idempotent Submission
- RECONNECT != RETAKE
- Student != Exam Participant != Exam Attempt != Exam Session
- Assessment Type != Exam Instance
- Question Bank Item != immutable Exam Question Snapshot
- Teacher != Proctor
- Violation Event != Risk Signal != Incident != Cheating Decision
- Risk Signal != verdict
- network/IP/location/device/reconnect context != cheating proof
- exam presence/check-in != general school attendance

## 3. ACTIVE-EXAM CRITICAL DEPENDENCY BOUNDARY

Architecture MUST preserve these active-exam MUST-HAVE dependencies:
- Identity / Auth
- Assessment Core
- Answer Persistence
- Timer Authority
- Submission
- Essential Security

Architecture MUST preserve these CAN-DEGRADE dependencies:
- Search
- Messaging
- Track
- Insight
- Partner
- Billing
- Noncritical Notification

These CAN-DEGRADE capabilities must not become mandatory synchronous dependencies capable of taking down an active exam.

Audit, Privacy, and Support active-exam reliability classification remains:
NOT EXPLICITLY ESTABLISHED

## 4. EXAM INSTANCE / PARTICIPANT / ATTEMPT / SESSION MODEL

- Exam Participant is assessment context, not Student Base Access.
- Attempt is not Session.
- Session loss does not inherently terminate or replace an Attempt.
- reconnect resumes the same valid Attempt when canonical conditions permit.
- reconnect must not silently create a Retake.
- a submitted Attempt must not return to an ambiguous active state.

## 5. ANSWER CONTINUITY / ZERO-LOST-ANSWER ARCHITECTURE

- answer state continuity must be preserved.
- distinction between locally pending answer state and server-acknowledged answer state.
- server acknowledgement representing acceptance of the corresponding answer write.
- interruption before acknowledgement not being treated as proof that the answer safely reached authoritative state.
- recovery/reconciliation after reconnect.
- no silent answer discard because a Session disappears.
- no dependency on noncritical domains for preservation of active-exam answers.

## 6. SERVER-AUTHORITATIVE TIMER

- authoritative exam time belongs to server-authoritative assessment state;
- client/device clock is not final authority;
- reconnect does not restart duration;
- session replacement/reconnect does not silently grant additional time;
- time continuity survives transient client/session interruption;
- policy-authorized adjustments must remain explicit governed state, not client inference.

## 7. IDEMPOTENT SUBMISSION

- retries/duplicates for the same logical submission must not create conflicting multiple final submissions;
- accepted submission produces an unambiguous submitted Attempt state;
- duplicate/retry behavior must converge on the same logical result;
- submission acceptance must be distinguishable from merely initiating a request;
- a Submission Receipt or equivalent authoritative confirmation concept may be required.

## 8. RECONNECT / RESUME / RECOVERY

- recovery attaches to the same valid Attempt unless a separately governed Retake is explicitly created;
- reconnect must reconcile authoritative and pending state;
- Session lifecycle may change without silently replacing Attempt lifecycle;
- recovery must not bypass identity, authorization, tenant, or assessment-context checks;
- recovery must not fabricate answers or authoritative state.

## 9. IMMUTABLE EXAM QUESTION SNAPSHOT

- an active/historical Attempt is bound to the examination question snapshot applicable to that exam context;
- later Question Bank Item edits must not mutate the question content already bound to the Attempt/Exam Instance;
- scoring/review/history must reference stable exam question truth;
- snapshot immutability does not prescribe physical storage strategy.

## 10. AUTHORITATIVE STATE / PARTIAL FAILURE

Secure Assessment is the authoritative logical domain for Secure Assessment business/runtime state created within the assessment context. It owns authoritative assessment state for:
- Exam Instance state;
- Exam Participant assignment/context for the specific Exam Instance;
- Exam Attempt state;
- Exam Session state;
- answer acknowledgement state;
- timer state;
- submission state;
- immutable Exam Question Snapshot state.

Upstream source truth remains with its established owner and is consumed through explicit handoff rather than silently re-owned:
- Identity remains authoritative for Person, User Account, and Authentication / Session Identity;
- Organization / Tenant remains authoritative for Organization, Tenant, and Membership;
- Academic Core remains authoritative only for the minimum academic truth it canonically owns;
- Sequence 3 authorization/security context remains an inherited enforcement input and is not re-owned by Secure Assessment.

The `Assessment Core` label in the active-exam MUST-HAVE dependency list does not by itself establish a separate bounded domain or source-of-truth owner.

Derived UI/client/projection state must not silently overwrite canonical assessment truth.

## 11. FAILURE CONTAINMENT / DEGRADED OPERATION

- active exam isolation from noncritical domain failure;
- Track/Insight/Partner/Billing/Search/Messaging/Noncritical Notification degradation;
- partial failure not implicitly invalidating an Attempt;
- failure not bypassing authorization/security requirements;
- pending/unknown state remaining explicit instead of being silently treated as success;
- later Sequence 6 handling runtime topology, failover mechanisms, observability mechanisms, and operations.

## 12. ASSESSMENT SECURITY / RISK BOUNDARY

- security/risk observations may create context/signals;
- network/IP/location/device/reconnect changes are not proof of cheating;
- risk signals must not directly mutate an Attempt into a cheating verdict;
- authoritative assessment state and disciplinary/adjudication state remain distinct where repository authority requires it;
- teacher/proctor authority remains inherited from Sequence 3.

## 13. INHERITED SEQUENCE 1 / 2 / 3 INPUTS

SEQUENCE 1:
system/domain boundaries, assessment isolation, source-domain ownership.

SEQUENCE 2:
tenant isolation, data ownership, trust/provenance, canonical/derived state, consistency boundaries.

SEQUENCE 3:
authentication requirements, assessment authorization, Teacher != Proctor, teacher-managed assessment authorization context, participant access constraints, security-context requirements.

## 14. CROSS-SEQUENCE HANDOFFS

Sequence 4 -> Sequence 5:
cross-domain contracts and integration details that must preserve Sequence 4 guarantees.

Sequence 4 -> Sequence 6:
runtime/reliability/operations mechanisms implementing Sequence 4 guarantees.

Sequence 4 -> Sequence 7:
traceability and Architecture exit verification.

## 15. PRODUCTION BLOCKER PRESERVATION

All 12 Production Blockers remain OPEN / CARRIED FORWARD.
RESOLVED / CLOSED: 0

- PB-06 Assessment Capability Testing: later implementation/testing closure; Sequence 4 Architecture does NOT close it.
- PB-07 Zero-Lost-Answer Verification: DIRECT Sequence 4 Architecture hook; actual verification remains unresolved Production readiness work.
- PB-11 Backup + Restore Verification: later runtime/verification closure.
- PB-12 Security / Incident-Response Readiness: later runtime/operations/Production-readiness closure.

## 16. OPEN / PROVISIONAL / FUTURE SAFETY

- detailed anti-cheating capability matrix: PROVISIONAL
- detailed split-screen heuristics: PROVISIONAL
- anti-cheating preset details: PROVISIONAL
- AI / AI proctoring: FUTURE / OPTIONAL / NON-BLOCKING
- Permission Matrix: do not create here
- Authentication implementation: do not reopen/finalize here

## 17. EXPLICIT NON-GOALS / TECHNOLOGY SAFEGUARD

This draft does NOT select or define:
- PostgreSQL/Postgres
- database engine
- physical schema
- tables/columns/keys
- ORM
- cross-domain FK strategy
- API endpoints
- request/response payloads
- concrete event schemas
- message broker/event bus
- sync-vs-async technology
- retry intervals
- timer polling/heartbeat numbers
- idempotency-key representation
- local-storage technology
- cache technology
- queue technology
- programming language
- framework
- frontend/backend stack
- cloud/vendor
- deployment topology
- InsForge
- runtime failover product
- final observability implementation
- backup/restore implementation
- incident-response operating procedure
- production application code

## 18. DRAFT EXIT CHECKLIST

- [x] canonical invariants preserved;
- [x] Zero Lost Answers covered;
- [x] server-authoritative timer covered;
- [x] idempotent submission covered;
- [x] reconnect != retake preserved;
- [x] Participant/Attempt/Session separation covered;
- [x] immutable Snapshot covered;
- [x] MUST-HAVE / CAN-DEGRADE boundary covered;
- [x] Audit/Privacy/Support not falsely classified;
- [x] risk signal != verdict preserved;
- [x] Sequence 1/2/3 not reopened;
- [x] PB-01 through PB-12 remain open;
- [x] maturity states preserved;
- [x] Sequence 5/6/7 not executed;
- [x] no technology selection;
- [x] no ERD/schema/API implementation design;
- [x] Build unauthorized.
