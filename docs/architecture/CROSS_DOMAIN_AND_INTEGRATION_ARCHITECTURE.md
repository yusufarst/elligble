# CROSS-DOMAIN AND INTEGRATION ARCHITECTURE

Status:
LOCKED

Version:
1.0.0

Artifact Type:
ARCHITECTURE

Canonical:
YES

Architecture Sequence:
SEQUENCE 5 - CROSS-DOMAIN & INTEGRATION ARCHITECTURE

Unit ID:
NONE

Architecture Unit Naming Convention:
NOT YET ESTABLISHED

Build:
NOT AUTHORIZED

## 1. PURPOSE / AUTHORITY / SCOPE

This artifact defines Sequence 5 as HOW-level cross-domain contract and integration-boundary Architecture. It consumes constraints established in Sequences 1, 2, 3, and 4 without reopening them. It explicitly does NOT authorize Build or close Production Blockers.

Sequence 5 refines cross-domain interaction Architecture without reopening domain ownership established by upstream LOCKED sources. It must not silently promote conceptual domains into microservices or choose implementation technology merely because cross-domain interaction exists.

## 2. CANONICAL CROSS-DOMAIN INVARIANTS

This architecture preserves all locked invariants:
- **ONE DOMAIN OWNS THE TRUTH**
- **OTHER DOMAINS USE EXPLICIT CONTRACTS**
- **MINIMUM NECESSARY DATA**
- **NO SILENT CROSS-DOMAIN WRITE**
- **NO PRIVACY LEAKAGE**
- **ASSESSMENT FAILURE ISOLATION**

A shared physical persistence environment does NOT imply shared ownership. Derived projections, snapshots, indexes, analytics, notifications, support records, and commercial state must not silently become source-domain truth. Logical domains are not mandated to become microservices.

Canonical distinctions preserved:
- Person != User Account != Membership
- Organization != Tenant
- Teacher != Proctor
- Base Access != Operational Assignment
- Track != Care
- Profile != Portfolio != Passport
- Application Snapshot != live Passport
- Path != Opportunity
- Opportunity != Application != Verified Connection != Outcome
- Support Case != Platform Incident
- Risk Signal != verdict

## 3. CROSS-DOMAIN CONTRACT MODEL

At the Architecture level, we distinguish contracts semantically:
- Authoritative source interaction
- Command/request intent
- Publication/notification
- Derived projection
- Immutable/historical snapshot
- Verification/confirmation
- Lifecycle transition

These semantic categories do NOT select implementations (e.g., REST, GraphQL, gRPC, event bus, queue, broker, direct in-process call, or persistence mechanisms).

## 4. CONTRACT OWNERSHIP AND WRITE BOUNDARY

- The source owner remains authoritative over its truth.
- A consumer may not silently mutate source-domain truth.
- Writes affecting source truth must return through an authorized source-domain workflow/contract.
- Shared persistence access never grants cross-domain ownership.
- Consumer-local derived state remains distinguishable from source truth.

## 5. CANONICAL CONTRACT MATRIX

Column definitions:
- **SOURCE DOMAIN**: The domain that owns the authoritative truth relevant to this contract.
- **CONSUMER / REQUESTER**: The domain that consumes information or requests a capability.
- **PURPOSE**: Why this cross-domain interaction exists.
- **INFORMATION OR CAPABILITY BOUNDARY**: What is exchanged at minimum necessary level.
- **INTERACTION SEMANTIC**: Abstract contract type (not transport selection).
- **AUTHORIZATION / TENANT BOUNDARY**: Access and isolation constraints.
- **PROHIBITED MUTATION**: What the consumer must not do.
- **FAILURE / DEGRADATION RULE**: Behavior when the consumer or propagation path is unavailable.
- **MATURITY / DEFERRAL**: Specific maturity status of this contract and what remains deferred.

### 5.1 Identity / Organization / Academic Core Prerequisites

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Identity | Organization / Tenant | Person / User Account context | Person identity and authentication context required for Membership establishment/use | Authoritative Source Interaction | Organization/Tenant context must be explicit; no implicit cross-tenant authority | Cannot rewrite Person / User Account truth; Identity does not own Membership | Default deny when required identity/authentication context is invalid | Contract LOCKED; PB-04 Authentication Policy remains OPEN; transport/runtime mechanism deferred |
| Identity | Academic Core | Identity prerequisite for academic operations | Minimum Person / User Account / authentication identity reference needed by Academic Core; Membership and tenant context remain Organization / Tenant-owned | Authoritative Source Interaction | Valid Organization/Tenant context must accompany use where applicable | Academic Core cannot rewrite Identity truth; Identity does not own Membership or academic assignment | Default deny when required identity/context is invalid | Contract LOCKED (MB-08 core); PB-04 remains OPEN; transport/runtime mechanism deferred |
| Organization / Tenant | Academic Core | Membership / Tenant context | Organization, Tenant, and Membership context required for academic operations | Authoritative Source Interaction | Tenant-isolated | Cannot rewrite Organization / Tenant / Membership truth | Default deny when required Membership/Tenant context is invalid | Contract LOCKED; transport/runtime mechanism deferred |
| Academic Core | Secure Assessment | Assessment academic-context handoff | Minimum authorized Academic Group/Rombel, enrollment/placement, and other applicable academic context required to establish assessment-specific participant context; teacher/proctor authority remains an inherited Sequence 3 authorization input | Authoritative Source Interaction | Participant-assignment / assessment-context scoped and tenant-isolated | Secure Assessment cannot rewrite Academic Core truth; Academic Core does not own Exam Participant / Exam Attempt / Exam Session runtime state | Missing or invalid required handoff leaves the assessment/entry unreachable; do not fabricate fallback academic or assignment context | Contract LOCKED (MB-08 core / MB-04 HD-03); runtime mechanism deferred to Sequence 6 |

### 5.2 Learning and Assessment Flow to Track

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Learn | Track | Progress tracking | Finalized/derived learning progress; minimum necessary | Publication | Tenant-isolated | Cannot rewrite Learn truth | Non-blocking; Track failure does not impact Learn | Contract LOCKED; mechanism deferred to Sequence 6 |
| Secure Assessment | Track | Finalized result propagation | Only finalized/approved assessment results; raw anti-cheating evidence excluded | Publication (non-blocking) | Tenant-isolated; signal-limited; no raw exam access | Cannot rewrite exam truth; Secure Assessment does not own or publish Early Warning; Track may derive Track-owned Early Warning only within Track rules | Track failure does not impact active exams; propagation is non-blocking relative to active submission | Contract LOCKED (MB-08 core); mechanism deferred to Sequence 6 |

Note: Early Warning is TRACK-owned derived signaling. Track may derive its own progress/early-warning state from authorized finalized results according to Track rules. Secure Assessment does not own or publish the canonical Early Warning.

### 5.3 Track Downstream Contracts

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Track | Care | Authorized referral | Minimum necessary referral context only; Care Case created only through authorized referral flow | Command / Request Intent | Highly restricted (minimum necessary); Care data isolation preserved | Cannot auto-create Care Case; Care returns safe workflow status, not private counseling notes | Intake delayed; Care unavailability does not destabilize Track | Contract LOCKED (MB-08 core); PB-08 Care Safeguarding remains OPEN; mechanism deferred to Sequence 6 |
| Track | Passport | Qualified record enrichment | Only meaningful, portable, appropriate, verified/approved records; Track does not dump all academic activity into Passport | Authorized Record Submission | Tenant-isolated; provenance required | Cannot rewrite live Passport truth; Passport remains owner of Passport Record after authorized record is created | Non-blocking | Contract LOCKED; qualification rules remain governance-level; mechanism deferred to Sequence 6 |
| Track | Path | Academic signal for planning | Selected academic signals through explicit contracts; private Care data excluded | Derived Projection | Purpose-limited | Cannot rewrite Path truth | Progress tracking degrades | Contract LOCKED; mechanism deferred to Sequence 6 |

### 5.4 Assessment to Passport

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Secure Assessment | Passport | Credential-like result enrichment | Only selected significant/standardized/credential-like results with provenance; routine exams do not automatically become Passport entries; Passport never receives raw exam answers; raw anti-cheating evidence excluded | Authorized Record Submission | Tenant-isolated; provenance required | Cannot rewrite live Passport truth; Passport remains owner of Passport Record after authorized record is created | Cannot block active exam; propagation failure does not invalidate submission | Contract LOCKED; qualification criteria remain governance-level; mechanism deferred to Sequence 6 |

### 5.5 Passport / Path / Opportunity Contracts

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Passport | Path | Readiness/requirement matching | Selected authorized Passport records for career guidance | Derived Projection | Purpose-limited (MB-08 core) | Cannot rewrite live Passport; Path cannot edit Passport records | Recommendations degrade | Contract LOCKED (MB-08 core); mechanism deferred to Sequence 6 |
| Passport (source of live record) | Partner & Opportunity Ecosystem (application context owns created snapshot) | Application-specific snapshot for Opportunity | Application Snapshot created from Passport context at application time; snapshot becomes immutable and owned by the application context | Historical Snapshot | Tenant-isolated; snapshot is frozen at creation | Live Passport changes after application must not mutate the historical snapshot; Passport remains owner of live source record; application context owns the created immutable snapshot | Application process fails if Passport unavailable | Contract LOCKED (MB-08 core); mechanism deferred to Sequence 6 |
| Partner & Opportunity Ecosystem | Path | Goal mapping / exploration | Opportunity information for exploration and planning | Derived Projection | Public/Tenant limits (MB-08 core) | Cannot rewrite Path truth; recommendation does not auto-create Application | Exploration degrades | Contract LOCKED (MB-08 core); mechanism deferred to Sequence 6 |

### 5.6 Partner Verification and Lifecycle Contracts

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Partner & Opportunity Ecosystem (owns Partner Organization, Opportunity, Application, Verified Connection) | Passport (receives verification/credential confirmation) | Credential verification / outcome confirmation | Partner may issue/verify approved credentials or confirm outcomes only through controlled authorized workflows | Verification / Confirmation | Purpose-limited; authorization-aware; consent-aware where applicable; no unrestricted student search | Partner cannot freely edit Passport; Passport owns Passport Record / provenance / verification state within its canonical boundary | Workflow degrades | Contract LOCKED; PB-09 Partner Verification/Moderation remains OPEN; transport/runtime mechanism deferred |
| Partner & Opportunity Ecosystem | Partner & Opportunity Ecosystem (internal lifecycle) | Opportunity -> Application -> Verified Connection lifecycle | Application requires a valid Opportunity context and does not automatically create Verified Connection | Lifecycle Transition | Purpose/context scoped | Cannot skip Opportunity/Application/Verified Connection lifecycle distinctions or auto-create Verified Connection | Transition remains pending/failed explicitly | Contract LOCKED; transport/runtime mechanism deferred |
| Partner & Opportunity Ecosystem (Verified Connection source context) | Alumni / Outcome | Verified Connection -> Outcome lifecycle handoff | Minimum authorized Verified Connection status/context and confirmation evidence sufficient for Outcome review; Verified Connection does not automatically create Outcome and important outcomes may require confirmation/review | Lifecycle Transition / Verification Request | Purpose-limited; originating tenant/context and actor authority preserved where applicable | Alumni / Outcome cannot rewrite Verified Connection truth; Partner & Opportunity Ecosystem cannot directly create or overwrite Outcome truth | Outcome transition remains pending/delayed when confirmation or receiving-domain processing is unavailable | Lifecycle prerequisite / conceptual capability dependency ESTABLISHED; HD-14 handoff boundary PROVISIONAL; Partner assertion != verified outcome; transport/runtime mechanism deferred |
| Alumni / Outcome (owns Outcome, Alumni Transition / Impact) | Schools / Platform | Post-graduation tracking | Purpose-limited alumni outcome information; Alumni continues using same Passport and Path; no duplicate alumni-specific identity | Publication / Derived | Purpose-limited to authorized recipients | Cannot rewrite Outcome truth | Tracking degrades | Contract LOCKED; transport/runtime mechanism deferred |

### 5.7 Parent / Guardian Projection

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Academic Core (and other authorized source domains) | Parent / Guardian | Authorized visibility | Projection over authorized data from source domains; Parent interaction with Care occurs only through Care workflows | Derived Projection | Authorized relationship only | Cannot rewrite Academic truth; does not own or directly modify source-domain truth | Projection degrades | Contract LOCKED; mechanism deferred to Sequence 6 |

### 5.8 Cross-Cutting Capability Contracts

| SOURCE DOMAIN | CONSUMER / REQUESTER | PURPOSE | INFORMATION OR CAPABILITY BOUNDARY | INTERACTION SEMANTIC | AUTHORIZATION / TENANT BOUNDARY | PROHIBITED MUTATION | FAILURE / DEGRADATION RULE | MATURITY / DEFERRAL |
|---|---|---|---|---|---|---|---|---|
| Source Domains | Notification | Alerting / delivery | Minimum safe event/payload data; Notification owns delivery records only | Publication / Notification | Tenant-isolated | Cannot own workflow truth | Notification delayed; does not destabilize source domains | Contract LOCKED; mechanism deferred to Sequence 6 |
| Source Domains | Search | Discovery / indexing | Derived projection / index; authorization rechecked against source domain when opening a resource | Derived Projection | Authorized scope; source-domain authorization re-check required | Cannot own source truth | Search degrades | Contract LOCKED; mechanism deferred to Sequence 6 |
| Source Domains | Feedback / Support | Case resolution | Minimum necessary diagnostic information; Support owns Support Case, not source-domain truth; Care/private data access is default-deny | Command / Request Intent | Authorized scope; exceptional scoped authorization for Care/private data | Cannot own academic/core truth; corrections must use authorized source-domain workflow | Support delayed | Contract LOCKED; mechanism deferred to Sequence 6 |
| Source Domains | Insight | Analytics / aggregation | Derived/aggregated data; never master data; cannot directly correct source records; assessment analytics remain asynchronous | Derived Projection | Purpose-limited | Cannot own source truth | Analytics degrade | Contract LOCKED; mechanism deferred to Sequence 6 |
| Source Domains | Billing | Commercial entitlement | Usage metrics; may control commercial entitlement/state only | Publication / Notification | Tenant-isolated | Cannot delete academic records, Passport, or interrupt active Assessment persistence/submission | Invoicing delayed; Billing failure does not destabilize active exams | Contract LOCKED; mechanism deferred to Sequence 6 |

## 6. DEPENDENCY DIRECTION AND LIFECYCLE SEMANTICS

Repository authority distinguishes lifecycle flow from strict OWNER -> CONSUMER contract direction. The strict contract/dependency view used by this Architecture is:

```text
IDENTITY
   |
ORGANIZATION / TENANT
   |
ACADEMIC CORE
   |--- LEARN ---> TRACK
   |--- ASSESS --> TRACK
   |--- PARENT
TRACK ---> CARE
TRACK ---> PASSPORT
TRACK ---> PATH
PASSPORT ---> PATH
PASSPORT ---> OPPORTUNITY
OPPORTUNITY ---> PATH
OPPORTUNITY ---> APPLICATION
APPLICATION ---> VERIFIED CONNECTION
VERIFIED CONNECTION ---> OUTCOME
OUTCOME ---> ALUMNI / IMPACT
```

Key directional clarifications:
- **Passport -> Opportunity**: CANONICAL contract direction. Passport is the live source for Application Snapshot creation/use, while the receiving application context owns the created immutable snapshot.
- **Opportunity -> Path**: CANONICAL contract direction. Path consumes Opportunity information.
- **Path -> Opportunity**: NOT a canonical reverse data contract. Product navigation can visually move from Path to Opportunity without reversing authoritative information ownership.
- **Verified Connection -> Outcome**: lifecycle prerequisite / conceptual capability dependency is established, while MB-04 HD-14 keeps the handoff boundary PROVISIONAL; inclusion in this view does not promote HD-14 to LOCKED.

Preserved distinctions:
- DEPENDENCY != DELIVERY CHRONOLOGY
- LIFECYCLE PREREQUISITE != WHOLE-CAPABILITY DELIVERY ORDER
- Opportunity != Application != Verified Connection != Outcome

Note on lifecycle entities vs. bounded domains: Opportunity, Application, Verified Connection belong to the **Partner & Opportunity Ecosystem** domain. Outcome and Alumni Transition / Impact belong to the **Alumni / Outcome** domain. These lifecycle stages are entity-level distinctions within their owning domains, not separate bounded domains.

## 7. REQUEST / COMMAND / PUBLICATION BOUNDARIES

Consumers interact via distinct abstract mechanisms:
- Requesting an authoritative capability.
- Requesting a source-domain state change.
- Receiving a source publication/notification.
- Consuming a derived projection.
- Consuming an immutable snapshot.

No single universal transport is required. Transport mechanisms remain unselected. Non-blocking behavioral requirements dictated upstream are explicitly preserved.

## 8. CONSISTENCY AND CROSS-DOMAIN EFFECTS

- Exactly one owner of canonical truth.
- No implicit distributed transaction assumption.
- Cross-domain derived state may experience explicit propagation delay unless stronger upstream invariants require otherwise.
- Pending/failed propagation must not be silently treated as success.
- Where retry or duplicate delivery/action can produce contradictory duplicate domain effects, the contract must require convergent/idempotent logical effect semantics. This does not require a universal technical idempotency mechanism for every cross-domain interaction; it applies where logically necessary.
- Canonical owner state always wins over stale derived projections.

Idempotency mechanism design (keys, storage, retry intervals, transport) remains deferred.

## 9. TENANT / AUTHORIZATION CONTEXT PROPAGATION

All cross-domain interactions must preserve:
- Tenant context where applicable.
- Actor/principal or delegated authority context.
- Scope/capability constraints.
- Source-domain authorization re-checks for protected resources.
- No implicit cross-tenant access.
- No global `SUPER_ADMIN` shortcuts.

Token/JWT/session formats remain undefined. PB-04 (Authentication Policy) and PB-05 (Permission Matrix) remain OPEN.

## 10. PRIVACY / PURPOSE LIMITATION / MINIMUM NECESSARY DATA

Requirements include:
- Minimum necessary disclosure.
- Purpose limitation enforcement.
- Student data is default-private.
- Care data is highly restricted.
- Consent/authorization hooks apply where established.
- Raw assessment evidence does not propagate arbitrarily.
- Partner student access is restricted (no unrestricted discovery).
- Support/search/insight projections are safely bounded.

PB-01 (Controller/Processor), PB-03 (DPIA), PB-08 (Care Safeguarding), PB-09 (Partner Verification/Moderation), and PB-10 (Data Classification + Consent) remain OPEN and unresolved.

## 11. SNAPSHOT / LIVE / DERIVED STATE SEMANTICS

Explicit distinctions:
- **Application Snapshot != live Passport**: The application context owns the created immutable snapshot. Passport owns the live source record. Live Passport edits do not mutate historical application snapshots.
- **Search**: Derived projection, not source truth.
- **Insight**: Derived/aggregated, not source truth.
- **Parent**: Authorized projection, not academic owner.
- **Notification**: Owns delivery state, not underlying workflow truth.
- **Support**: Owns Support Case, not source-domain truth.

## 12. SECURE ASSESSMENT CROSS-DOMAIN PROTECTION

Sequence 4 is strictly preserved:
- Active exam submission cannot depend on Track/Insight/Partner/Billing/Search/Messaging/noncritical Notification availability.
- Finalized assessment result propagation to Track is non-blocking relative to active submission.
- Raw anti-cheating evidence does not flow to Track.
- Routine exam data does not automatically become Passport truth.
- Passport never receives raw exam answers.
- Downstream propagation failure cannot invalidate an already-authoritative assessment submission.
- Risk signal != verdict.
- Network/IP/location/device/reconnect signal != cheating proof.
- RECONNECT != RETAKE.
- No cross-domain operation may bypass assessment authorization/security.
- Zero Lost Answers, server timer, idempotent submission, reconnect continuity, and immutable question snapshots remain untouched.
- Early Warning is Track-owned derived signaling, not Assessment-published state.

## 13. EXTERNAL INTEGRATION TRUST BOUNDARIES

External integration categories based on canonical scope:

### 13.1 Partner Organization / Partner Staff External Boundary
- **Internal Authoritative Owner**: Partner & Opportunity Ecosystem owns Partner Organization.
- **Ingress Responsibility**: Partner & Opportunity Ecosystem controls Partner onboarding/registration.
- **Egress Responsibility**: Partner & Opportunity Ecosystem controls what information is shared externally.
- **External Authority Classification**: Partner Organization is an external actor; Partner Staff operate under specific authorization limits.
- **Trust/Verification Boundary**: Partner identity and authorization must be verified; PB-09 remains OPEN.
- **Tenant/Context Boundary**: Tenant-isolated; Partner cannot access cross-tenant data.
- **Purpose Limitation**: Purpose-limited access; no unrestricted student search or discovery.
- **Failure Containment**: Partner unavailability does not destabilize Academic Core or active Assessment.
- **Implementation Deferral**: Concrete integration mechanism deferred to Sequence 6/Build.

### 13.2 Opportunity External-Facing Boundary
- **Internal Authoritative Owner**: Partner & Opportunity Ecosystem owns Opportunity.
- **Ingress Responsibility**: Partner & Opportunity Ecosystem controls Opportunity creation/update.
- **Egress Responsibility**: Opportunity information exposed to Path consumers under public/tenant limits.
- **External Authority Classification**: External Opportunity providers submit through controlled Partner workflows.
- **Trust/Verification Boundary**: Architecture preserves verification/moderation hooks and controlled Partner workflows, but the concrete Opportunity verification/moderation policy remains unresolved under PB-09; do not assume a mandatory pre-publication rule.
- **Tenant/Context Boundary**: Tenant-isolated where applicable; public Opportunities bounded by authorization.
- **Purpose Limitation**: Cannot auto-create Applications.
- **Failure Containment**: Opportunity unavailability degrades exploration; does not destabilize core domains.
- **Implementation Deferral**: Concrete integration mechanism deferred to Sequence 6/Build.

### 13.3 Application Ingress / Application-Specific Snapshot Boundary
- **Internal Authoritative Owner**: Partner & Opportunity Ecosystem owns Application lifecycle.
- **Ingress Responsibility**: Application creation requires explicit student action; snapshot is frozen from Passport at creation.
- **Egress Responsibility**: Application-specific snapshot shared with Partner under purpose limitations.
- **External Authority Classification**: Partner receives snapshot, not live Passport access.
- **Trust/Verification Boundary**: Partner access is application-specific, not unrestricted.
- **Snapshot Requirement**: Application Snapshot is immutable; live Passport changes do not alter it.
- **Failure Containment**: Application process failure does not destabilize Passport or Assessment.
- **Implementation Deferral**: Concrete integration mechanism deferred to Sequence 6/Build.

### 13.4 Credential / Verification / Confirmation Boundary
- **Internal Authoritative Owner**: Passport owns Passport Record / provenance / verification state.
- **Ingress Responsibility**: Partner-issued credentials/verifications enter through controlled authorized workflows.
- **Egress Responsibility**: Only verification status and controlled credential information flow.
- **External Authority Classification**: Partner may be an external asserting/verifying authority for specific credentials.
- **Trust/Verification Boundary**: External assertions are evidentiary, not automatically authoritative Passport truth.
- **Tenant/Context Boundary**: Consent-aware where applicable.
- **Purpose Limitation**: Cannot freely edit Passport; no unrestricted student search.
- **Failure Containment**: Verification workflow degradation does not destabilize core domains.
- **Implementation Deferral**: Concrete integration mechanism deferred to Sequence 6/Build; PB-09 remains OPEN.

### 13.5 Verified Connection / Outcome External Confirmation Boundary
- **Internal Authoritative Owner**: Partner & Opportunity Ecosystem owns Verified Connection; Alumni / Outcome owns Outcome.
- **Ingress Responsibility**: External confirmation of connection/outcome status through controlled workflows.
- **Egress Responsibility**: Purpose-limited outcome information to authorized recipients.
- **External Authority Classification**: External parties may provide evidentiary confirmation; internal domain retains canonical lifecycle authority.
- **Trust/Verification Boundary**: Important outcomes may require confirmation/review before Alumni / Outcome accepts them as canonical Outcome state.
- **Maturity Boundary**: Verified Connection -> Outcome lifecycle prerequisite / conceptual dependency is established, but the MB-04 HD-14 handoff boundary remains PROVISIONAL; external confirmation does not promote HD-14 to LOCKED.
- **Tenant/Context Boundary**: Tenant-isolated.
- **Purpose Limitation**: Schools receive only purpose-limited alumni outcome information.
- **Failure Containment**: External confirmation failure delays lifecycle transition; does not destabilize core domains.
- **Implementation Deferral**: Concrete integration mechanism deferred to Sequence 6/Build.

Higher-education source strategy remains OPEN where relevant. No higher-education integration is invented absent from repository authority.

External input is not automatically authoritative. Failures must be contained without collapsing core domains. Concrete technologies remain deferred.

## 14. FAILURE / DEGRADATION BOUNDARIES

Dependencies explicitly preserve isolation:
- Path Down != Passport Down
- Partner Down != Academic Core Down
- Track Down != Exam Down
- Insight Down != Source Data Lost
- Billing Down != Active Exam Down

Failure handling principles:
- Canonical source remains valid when noncritical consumers are unavailable.
- Failed propagation remains explicitly tracked.
- Retry/reconciliation expectations exist without defined mechanisms or timing.
- Noncritical integration failures must not destabilize mission-critical assessments.

## 15. AUDITABILITY / TRACE REQUIREMENTS

Cross-domain interactions must be traceable to establish:
- Originating domain.
- Authoritative owner.
- Tenant/context (where required).
- Actor/authority (where applicable).
- Requested/published action.
- Acceptance/rejection status (where material).
- Correlation to relevant lifecycle/snapshot state.

Logging platforms, event schemas, SIEM, and retention periods remain undefined.

## 16. PRODUCTION BLOCKER / MATURITY PRESERVATION

- **TOTAL PRODUCTION BLOCKERS**: 12
- **OPEN / CARRIED FORWARD**: 12
- **RESOLVED / CLOSED**: 0

Sequence 5 hooks by Production Blocker:
- **PB-01** (Controller/Processor): Cross-domain data-flow boundaries provide evidence useful to legal allocation; legal allocation itself remains OPEN.
- **PB-02** (Retention): Cross-domain lifecycle/snapshot semantics must support configurable retention; retention periods remain OPEN.
- **PB-03** (DPIA): Cross-domain processing/data-flow evidence useful to DPIA; DPIA itself remains OPEN.
- **PB-04** (Authentication Policy): Cross-domain interactions require authentication/authorization propagation; final policy remains OPEN.
- **PB-05** (Permission Matrix): Cross-domain authorization re-checks require scoped permission enforcement; matrix itself remains OPEN.
- **PB-06** (Assessment Capability Testing): Implementation/verification concern; not directly addressed by Sequence 5.
- **PB-07** (Zero-Lost-Answer Verification): Implementation/verification concern; not directly addressed by Sequence 5.
- **PB-08** (Care Safeguarding): Track->Care boundary preserves restricted access hooks; safeguarding policy remains OPEN.
- **PB-09** (Partner Verification/Moderation): Partner trust boundary preserves verification/moderation hooks; policy remains OPEN.
- **PB-10** (Data Classification + Consent): Cross-domain privacy/purpose-limitation boundaries preserve hooks; governance remains OPEN.
- **PB-11** (Backup + Restore): Runtime/verification concern; deferred to Sequence 6.
- **PB-12** (Security/IR Readiness): Cross-domain auditability/trace requirements provide hooks; operational readiness remains OPEN.

**Cross-Domain FK / Event Strategy**: PROVISIONAL (do not falsely finalize implementation).
**AI**: FUTURE / OPTIONAL / NON-BLOCKING.

## 17. EXPLICIT NON-GOALS / SEQUENCE HANDOFFS

This draft explicitly excludes:
- Final database engine.
- Physical schema (tables/columns/keys).
- Final cross-domain FK implementation.
- ORM.
- REST/GraphQL/gRPC.
- Endpoint paths.
- Request/response payload schemas.
- Concrete event schemas.
- Broker/event-bus/queue technology.
- Outbox/CDC/event-sourcing/CQRS.
- Sync-vs-async technology mechanism.
- Retry intervals.
- Cache.
- Framework/language.
- Frontend/backend stack.
- Cloud/vendor.
- Deployment topology.
- InsForge.
- Application code.

**Sequence 5 -> Sequence 6 Handoff**: Runtime/reliability/operations mechanisms, deployment topology, observability mechanisms, operational retry/recovery mechanisms, and technology-selection criteria.
**Sequence 5 -> Sequence 7 Handoff**: Traceability and Architecture exit verification.

Build remains unauthorized.

## 18. DRAFT EXIT CHECKLIST

- [x] Canonical source ownership preserved
- [x] No silent cross-domain write
- [x] Contract directions preserved
- [x] Minimum necessary/privacy preserved
- [x] Tenant/auth context covered
- [x] Snapshot/live/derived distinctions covered
- [x] Partner restrictions preserved
- [x] Application lifecycle distinctions preserved
- [x] Secure Assessment isolation preserved
- [x] Noncritical propagation cannot block active exam
- [x] Cross-domain consistency expectations covered
- [x] Failure/degradation boundaries covered
- [x] External integration trust boundaries covered
- [x] Auditability requirements covered
- [x] 12 Production Blockers remain open
- [x] Maturity states preserved
- [x] No technology selection
- [x] No ERD/schema
- [x] No concrete API/payload/event schema
- [x] Sequence 6/7 not executed
- [x] Build unauthorized
