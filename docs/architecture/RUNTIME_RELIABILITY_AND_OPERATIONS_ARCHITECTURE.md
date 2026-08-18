# SEQUENCE 6 - RUNTIME, RELIABILITY, AND OPERATIONS ARCHITECTURE

## 1. CONTROL METADATA
- **Status:** LOCKED
- **Version:** 1.0.0
- **Artifact Type:** ARCHITECTURE
- **Canonical:** YES
- **Phase:** ARCHITECTURE
- **Architecture Sequence:** SEQUENCE 6 - RUNTIME / RELIABILITY / OPERATIONS ARCHITECTURE
- **Last Reviewed:** 2026-08-18

## 2. PURPOSE AND AUTHORITY
This document establishes the Sequence 6 Runtime, Reliability, and Operations Architecture for ELLIGBLE. It defines mechanism-neutral runtime boundaries, failure-containment rules, disaster recoverability constraints, observability parameters, deployment criteria, and operational security hooks necessary to support the system's authoritative domain contracts.

## 3. SCOPE
This architecture governs:
- Runtime boundaries and failure-domain separation
- Reliability and partial-failure degraded-mode behavior
- Secure Assessment critical operational continuity
- Mechanism-neutral cross-domain sync and recovery semantics
- System-wide observability, auditability, and incident readiness
- Migration and bootstrap architecture-level safe execution requirements

## 4. NON-GOALS / IMPLEMENTATION DEFERRALS
Consistent with Phase Index bounds, this substantive draft explicitly defers:
- final technology stack: NOT SELECTED
- DATABASE ENGINE: NOT SELECTED
- BROKER / QUEUE: NOT SELECTED
- DEPLOYMENT TOPOLOGY: NOT SELECTED
- CLOUD / VENDOR: NOT SELECTED
- physical schema definitions
- concrete event schema, payload definitions, or endpoints
- specific numeric SLA / SLO / RTO / RPO / retry count / timeouts (NOT YET ESTABLISHED)

## 5. LOCKED UPSTREAM INVARIANTS
This architecture preserves and strictly adheres to the following downstream invariants locked in Sequences 1-5:
- **Domain Truth**: ONE DOMAIN OWNS THE TRUTH
- **Data Mutation**: NO SILENT CROSS-DOMAIN WRITE
- **Privacy Scope**: MINIMUM NECESSARY DATA
- **Assessment Integrity**: Zero Lost Answers, Server-Authoritative Timer, Idempotent Submission, immutable Exam Question Snapshot, active-exam isolation from noncritical domains.
- **State Logic**: RECONNECT != RETAKE, Exam Participant != Exam Attempt != Exam Session
- **Incident Semantics**: Support Case != Platform Incident, Risk Signal != Incident != Cheating Decision

## 6. RUNTIME RESPONSIBILITY AND FAILURE-DOMAIN MODEL
- canonical domain ownership remains logically authoritative;
- runtime design preserves source-of-truth, tenant, privacy, and security boundaries;
- logical domain boundaries inform containment requirements;
- logical domains do NOT imply one physical runtime, one service, one server, or one failure domain per domain;
- shared runtime remains possible where required boundaries are enforceable;
- separated runtime remains possible where isolation requirements require it;
- failure-domain boundaries must prevent unacceptable cascading and protect critical paths;
- final topology remains NOT SELECTED.

## 7. CRITICAL VS NONCRITICAL DEPENDENCY ISOLATION
- **Critical Paths**: Paths required for Zero-Lost-Answer execution (Secure Assessment) are strictly separated from general processing.
- **Isolation Requirement**: Critical path domains must be insulated such that an outage or performance degradation in a downstream noncritical dependency cannot bottleneck, block, or cause failure in the critical domain.

## 8. FAILURE CONTAINMENT AND DEGRADED-MODE ARCHITECTURE
- noncritical dependency failure MAY degrade or suspend the affected noncritical capability while preserving owner truth;
- critical dependency failure MAY produce explicit unavailable, pending, interrupted, or recovery-required state;
- avoidable cascading must be contained;
- failure propagation must remain explicit and bounded;
- canonical truth remains protected;
- authorization/security/tenant boundaries remain enforced;
- UNKNOWN != SUCCESS;
- PENDING != SUCCESS;
- FAILURE != SUCCESS.

## 9. AUTHORITATIVE TRUTH DURING FAILURE / UNCERTAIN STATE
- **Truth Invariant**: DERIVED STATE MUST NOT OVERRIDE OWNER TRUTH.
- **Uncertainty Resolution**: During network partitions or operational failures where state transfer status is pending or unknown, the system must retain explicit uncertainty markers and defer reconciliation to the owning domain's canonical record.

## 10. SECURE ASSESSMENT RUNTIME CONTINUITY

ANSWER CONTINUITY:
- locally pending answer state != server-acknowledged answer state;
- server acknowledgement represents authoritative acceptance of the corresponding answer write;
- interruption before acknowledgement is NOT proof that the answer reached authoritative state;
- reconnect/recovery reconciles pending and authoritative state;
- Session loss must not silently discard answers.

SERVER-AUTHORITATIVE TIMER:
- authoritative exam time belongs to server-authoritative assessment state;
- client/device clock is not final authority;
- reconnect does not restart duration;
- reconnect/session replacement does not silently grant extra time;
- time continuity survives transient client/session interruption;
- policy-authorized adjustment remains explicit governed state.

RECONNECT / RETAKE:
- recovery resumes the same valid Attempt when canonical conditions permit;
- reconnect must not silently create a Retake;
- Session lifecycle may change without silently replacing Attempt lifecycle;
- recovery must preserve identity, authorization, tenant, and assessment-context checks.

IDEMPOTENT SUBMISSION:
- Idempotent Submission is distinct from answer-state continuity;
- accepted submission must be distinguishable from initiating a request;
- retry/duplicate of the same logical submission converges without conflicting multiple final submissions.

ACTIVE-EXAM CAN-DEGRADE LIST EXACTLY:
Search
Messaging
Track
Insight
Partner
Billing
Noncritical Notification

MUST-HAVE:
Identity / Auth
Assessment Core
Answer Persistence
Timer Authority
Submission
Essential Security

Audit / Privacy / Support active-exam reliability classification:
NOT EXPLICITLY ESTABLISHED

## 11. RECOVERY / RETRY / REPLAY / RECONCILIATION REQUIREMENTS
- **Sync/Async Independence**: Regardless of eventual transport layer, failure recovery capabilities (retry, replay, duplicate-effect safety) must be structurally accommodated by the canonical domain owner.
- **Reconciliation Authority**: Domain owners must expose safe methods for consumers to reread or revalidate canonical truth following a prolonged outage or data drift.
- **Execution Limits**: Retry interval, polling interval, and capacity targets are NOT YET ESTABLISHED.

## 12. CROSS-DOMAIN OPERATIONAL BEHAVIOR
- canonical owner remains authoritative;
- failed/delayed contract propagation remains explicit;
- retry/replay/reconciliation capability exists where contract semantics require recovery;
- duplicate-effect safety is required where retry/replay may repeat the same logical operation;
- consumer recovery must not silently rewrite owner truth;
- delayed/uncertain state must not become false success;
- consumer/source recovery may reread/revalidate owner truth.

## 13. OBSERVABILITY / AUDITABILITY ARCHITECTURE
Observability architecture must physically cover:
- runtime health visibility
- dependency degradation/failure visibility
- critical-workflow visibility
- Secure Assessment continuity visibility
- cross-domain propagation/reconciliation visibility
- security-relevant operational visibility
- audit evidence preservation during failure
- correlation requirements where needed
- operational-status vs user-workflow-status distinction

Preserve privacy/minimum-necessary/tenant boundaries.
Monitoring/logging/SIEM technology remains NOT SELECTED.

## 14. BACKUP / RESTORE ARCHITECTURE
Backup and restore architecture must physically cover all eleven areas:
1. authoritative state requiring recoverability;
2. tenant isolation during backup/restore;
3. Secure Assessment critical-state recoverability;
4. canonical vs derived-state restoration semantics/order;
5. immutable/historical record preservation;
6. Application Snapshot/history integrity;
7. restoration authorization;
8. privileged restoration auditability;
9. post-restore verification;
10. post-recovery reconciliation;
11. derived-state rebuilding only from authorized canonical sources.

PB-11:
OPEN / CARRIED FORWARD

BACKUP VERIFICATION PASSED:
NO

RESTORE VERIFICATION PASSED:
NO

RTO:
NOT YET ESTABLISHED

RPO:
NOT YET ESTABLISHED

## 15. SECURITY / INCIDENT-READINESS ARCHITECTURE HOOKS
Incident handling architecture must physically cover:
- runtime security-boundary enforcement
- security-relevant operational visibility
- incident-detection inputs
- tenant-impact containment
- privileged operational action authorization
- privileged operational action auditability
- audit evidence preservation
- Secure Assessment protection during incidents
- post-incident recovery/reconciliation

Support Case != Platform Incident
Risk Signal != Incident != Cheating Decision
network/IP/location/device/reconnect context != proof of cheating

Incident handling must preserve:
- critical continuity
- authorization
- evidence
- authoritative state

PB-12:
OPEN / CARRIED FORWARD

## 16. DEPLOYMENT / RUNTIME REQUIREMENTS
Runtime and deployment choices must physically require technology-neutral support for:
- critical vs noncritical containment
- tenant-isolation enforceability
- recovery without owner-truth corruption
- critical-path capacity/isolation according to later established targets
- evolution of runtime separation without changing canonical ownership
- qualitative scaling/recovery characteristics

Final topology:
NOT SELECTED

## 17. TECHNOLOGY-SELECTION CRITERIA
Technology selection logic must physically include evaluation criteria for:
- tenant isolation
- owner-truth consistency semantics
- duplicate-effect/idempotent/convergent behavior WHERE REQUIRED
- failure containment
- Secure Assessment Zero Lost Answers capability
- Secure Assessment continuity
- observability/auditability
- backup/restore
- security/privacy enforcement
- operability
- recoverability
- maintainability
- migration/bootstrap safety
- testability

Final technology stack remains NOT SELECTED.

## 18. MIGRATION / BOOTSTRAP ARCHITECTURE STRATEGY
Migration and bootstrap execution must physically establish:
- tenant-boundary preservation
- canonical domain/source-of-truth preservation
- NO SILENT CROSS-DOMAIN WRITE
- dependency/order/precondition requirements
- safe restart/re-execution
- idempotent OR convergent behavior where appropriate to operation semantics
- explicit partial-completion/failure state
- privileged-action authorization
- auditability
- precondition verification
- postcondition verification
- failure detection
- recovery/reconciliation
- active Secure Assessment protection
- later Build implementation testability

No migration scripts.
No bootstrap scripts.
No executable Build work.

## 19. PRODUCTION BLOCKER ARCHITECTURE MAPPING
- **PB-01**: processing/data-flow boundary support; legal allocation remains unresolved.
- **PB-02**: configurable retention/deletion support; retention periods remain unresolved.
- **PB-03**: processing/data-flow evidence useful to DPIA; DPIA completion/requirement not resolved here.
- **PB-04**: authentication/security enforcement support; final policy not approved here.
- **PB-05**: scoped permission/capability support; Permission Matrix remains missing.
- **PB-06**: assessment capability testability; testing remains unverified.
- **PB-07**: Zero Lost Answers Architecture support; runtime verification remains unresolved.
- **PB-08**: restricted Care/safeguarding hooks; policy remains OPEN.
- **PB-09**: purpose-limited Partner/moderation hooks; policy remains unresolved.
- **PB-10**: classification/consent enforcement hooks; governance remains OPEN.
- **PB-11**: backup/restore support; verification remains OPEN.
- **PB-12**: security/incident-readiness support; operational readiness remains OPEN.

PRODUCTION BLOCKERS:
12 OPEN / CARRIED FORWARD

RESOLVED / CLOSED:
0

## 20. OPEN / PROVISIONAL / FUTURE SAFETY
- **Cross-Domain FK / Event Strategy:** PROVISIONAL
- **final technology stack:** PROVISIONAL / NOT SELECTED
- **AI:** FUTURE / OPTIONAL / NON-BLOCKING

## 21. ARCHITECTURE DECISIONS AND EXPLICIT DEFERRALS
- **Decided**: Failure domain containment boundaries; critical path assessment isolation requirements; duplicate-effect safety where retry/replay can repeat the same logical operation; basic operational security/audit preservation properties.
- **Deferred**: Physical tech-stack implementation choices; concrete deployment configurations; migration scripts; numeric capacity/reliability targets (SLA/SLO).

## 22. SEQUENCE 6 COVERAGE / QUESTION TRACE
| QUESTION ID | ARTIFACT SECTION | DISPOSITION | EVIDENCE SUMMARY | DEFERRAL REASON IF ANY |
|---|---|---|---|---|
| Q1 | Sec 6 | ANSWERED | Logical boundaries vs failure domains defined | |
| Q2 | Sec 7 | ANSWERED | Critical vs noncritical failure separation | |
| Q3 | Sec 16 | ANSWERED | Containment of noncritical failures supported | |
| Q4 | Sec 8 | ANSWERED | Partial failure degrades capability, preserves truth | |
| Q5 | Sec 8 | ANSWERED | Canonical truth remains protected | |
| Q6 | Sec 9 | ANSWERED | State transfer explicitly defers to owner on uncertainty | |
| Q7 | Sec 15 | ANSWERED | Support Case vs Platform Incident boundary | |
| Q8 | Sec 8 | ANSWERED | Avoidable cascading contained | |
| Q9 | Sec 10 | ANSWERED | Answer state continuity and reconnect handled | |
| Q10 | Sec 10 | ANSWERED | Local pending vs server acknowledged separation | |
| Q11 | Sec 10 | ANSWERED | Server-Authoritative Timer during interruption | |
| Q12 | Sec 10 | ANSWERED | RECONNECT vs RETAKE | |
| Q13 | Sec 10 | ANSWERED | Idempotent submission convergence | |
| Q14 | Sec 11 | ANSWERED | Revalidation of truth supported | |
| Q15 | Sec 9 | ANSWERED | Derived state overridden by truth | |
| Q16 | Sec 11 | ANSWERED | Reread/revalidate methods covered | |
| Q17 | Sec 13 | ANSWERED | runtime health visibility | |
| Q18 | Sec 13 | ANSWERED | dependency failure visibility | |
| Q19 | Sec 13 | ANSWERED | critical workflow visibility | |
| Q20 | Sec 13 | ANSWERED | Secure Assessment continuity visibility substantively covered | |
| Q21 | Sec 13 | ANSWERED | audit trace preservation | |
| Q22 | Sec 13 | ANSWERED | user-impact vs operational-status distinction | |
| Q23 | Sec 14 | ANSWERED | authoritative state recoverability scope substantively covered | |
| Q24 | Sec 14 | ANSWERED | tenant isolation during backup/restore | |
| Q25 | Sec 14 | ANSWERED | restored canonical vs derived consistency | |
| Q26 | Sec 14 | ANSWERED | restoration authorization substantively covered | |
| Q27 | Sec 15 | ANSWERED | runtime security boundary enforcement | |
| Q28 | Sec 15 | ANSWERED | security-relevant observability hooks | |
| Q29 | Sec 15 | ANSWERED | audit evidence preserved during failure | |
| Q30 | Sec 15 | ANSWERED | Secure Assessment security during incidents substantively covered | |
| Q31 | Sec 6 | ANSWERED | Enforced boundaries on runtime | |
| Q32 | Sec 16 | ANSWERED | scaling/recovery characteristics substantively covered | |
| Q33 | Sec 17 | ANSWERED | operability, recoverability, maintainability criteria substantively covered | |
| Q34 | Sec 17 | ANSWERED | tenant-isolation capability criteria for technologies | |
| Q-MB-01 | Sec 18 | ANSWERED | migration/bootstrap requirements | |
| Q-MB-02 | Sec 18 | ANSWERED | migration/bootstrap requirements | |
| Q-MB-03 | Sec 18 | ANSWERED | migration/bootstrap requirements | |

## 23. DRAFT EXIT CHECKLIST
- [x] Substantive requirements defined without implementation pollution.
- [x] Canonical domain truth ownership maintained.
- [x] All 37 Sequence 6 questions demonstrably addressed.
- [x] No premature technology selections enforced.
- [x] 12 Production Blockers correctly mapped and deferred to future resolution gates.