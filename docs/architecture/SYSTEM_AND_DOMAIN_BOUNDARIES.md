# ELLIGBLE System and Domain Boundaries

**Status:** LOCKED  
**Version:** 1.0.0  
**Phase:** ARCHITECTURE  
**Architecture Sequence:** SEQUENCE 1 - SYSTEM & DOMAIN BOUNDARIES  
**Artifact Type:** ARCHITECTURE  
**Canonical:** YES  
**Architecture Unit ID:** NONE  
**Architecture Unit Naming Convention:** NOT YET ESTABLISHED  
**Build:** NOT AUTHORIZED  

---

## 1. PURPOSE AND AUTHORITY

- This artifact is Architecture Sequence 1.
- It refines HOW-level system and domain boundaries without overriding LOCKED/FROZEN upstream decisions.
- It is LOCKED.
- It does not authorize Build.

## 2. SYSTEM CONTEXT BOUNDARY

The logical architectural system-context boundary of ELLIGBLE is strictly defined. We preserve the explicit distinctions between:
- The ELLIGBLE platform itself.
- Academic school organizations (the entities).
- Academic Tenants (the isolated system environments).
- External Partner Organizations.
- Platform actors.
- External ecosystem entities.

**Tenant Scope Constraints:**
- **ACADEMIC TENANT BASELINE:** SMA, SMK, MA, MAK, and equivalent upper-secondary institutions.
- **OUTSIDE CURRENT ACADEMIC TENANT BASELINE:** SMP, MTs.
- **PILOT / REFERENCE TENANT:** SMA N 1 Mlati is a pilot/reference tenant only and is NOT the identity of ELLIGBLE.

We preserve the baseline rule that one school = one academic tenant baseline. Organization != Tenant. Beyond-school Partner Organizations are not academic tenants merely by participating in the ecosystem.

Network and deployment topologies are not defined at this level.

## 3. LOGICAL ARCHITECTURAL DOMAIN BOUNDARIES

We map and preserve the canonical major logical boundaries across the conceptual modules. We preserve the upstream classifications rather than flattening all major areas into one domain type. The following logical architectural areas / responsibility boundaries exist:

- **Shared Platform Core:** MAJOR PLATFORM AREA / shared capability layer.
- **School Operating System:** MAJOR PLATFORM AREA.
  - **Academic Core:** DOMAIN AREA / BASELINE.
  - **Learn:** DOMAIN AREA / OPTIONAL.
  - **Student Administration:** FUNCTIONAL MODULE / BASELINE.
  - **Parent / Guardian:** FUNCTIONAL MODULE / BASELINE.
  - **Care:** FUNCTIONAL MODULE / BASELINE (Care safeguarding remains OPEN).
  - **School Insight:** FUNCTIONAL MODULE / BASELINE.
- **Secure Assessment:** DOMAIN AREA / MISSION-CRITICAL.
- **Track:** DOMAIN AREA.
- **Passport:** DOMAIN AREA.
- **Path:** DOMAIN AREA.
- **Partner & Opportunity Ecosystem:** DOMAIN AREA / ECOSYSTEM AREA.
- **Alumni & Impact:** DOMAIN AREA / LIFECYCLE CONTEXT.
- **Talent Assurance:** STRATEGIC DIRECTION / FUTURE-PROVISIONAL mechanism (not an operational domain).

We do not invent additional bounded domains without explicit canonical evidence. Every conceptual module is not automatically a deployable service.

## 4. DOMAIN RESPONSIBILITY AND SOURCE-OF-TRUTH BOUNDARIES

These canonical ownership rules govern the Architecture:
- **ONE DOMAIN OWNS THE TRUTH.** Each major responsibility has a single authoritative logical architectural area.
- **NO SILENT CROSS-DOMAIN WRITE.** Data changes across boundaries occur via explicit contracts.
- **MINIMUM NECESSARY DATA.** Areas share only what is strictly required to fulfill contracts.
- **NO PRIVACY LEAKAGE.** Private student data does not cross boundaries without authorization.
- **ASSESSMENT FAILURE ISOLATION.** Secure Assessment must survive failures in other areas.

These constraints guide logical ownership, but do not dictate tables, schemas, or persistence mechanisms here.

## 5. SHARED CAPABILITY BOUNDARY

Shared/cross-cutting capabilities MUST NOT silently take ownership of source-domain records outside their canonical responsibilities. However, they explicitly own source truth within their scope. At minimum:

- **Identity** owns: Person, User Account, Authentication / Session Identity.
- **Organization / Tenant** owns: Organization, Tenant, Membership, Organization Relationships.
- **Notification** owns: Notification Delivery Records. It DOES NOT OWN the originating business workflow state. Source domains provide only minimum safe event/payload information.
- **Feedback & Support** owns: Support Case and Feedback Record. It DOES NOT OWN the source-domain truth being reported or corrected. Corrections to source truth use authorized source-domain workflows.
- **Billing** owns: Subscription / Commercial State. It MAY CONTROL commercial entitlement/state only. It MUST NOT delete academic records, own Passport truth, interrupt active Assessment persistence/submission, or become an active-exam required dependency.
- **Search** is a derived projection/index. Opening a resource requires authorization to be rechecked against the authoritative source domain. Search does not become source-domain truth.

Other capabilities (e.g., Access Control, Messaging, Audit, Privacy / Trust / Security) are logical shared/cross-cutting capabilities that must likewise respect canonical ownership where upstream sources define it. They are not automatically microservices.

## 6. CANONICAL DISTINCTION PRESERVATION

Architecture boundaries preserve the following logical distinctions explicitly:
- Organization != Tenant
- Person != User Account != Membership
- Base Access != Operational Assignment
- Teacher != Teaching Assignment
- Teacher != Proctor
- Academic Group / Rombel != Learning Classroom != Exam Room
- Student != Exam Participant != Exam Attempt != Exam Session
- Assessment Type != Exam Instance
- Question Bank Item != Exam Question Snapshot
- Track != Care
- Profile != Portfolio != Passport
- Application Snapshot != live Passport
- Path != Opportunity
- Partner Organization != academic Tenant
- Partner Organization != Partner Staff
- Alumni remains lifecycle/context of the same Person
- Support Case != Platform Incident
- Violation Event != Risk Signal != Incident != Cheating Decision
- Assessment Score != Official School Grade (where authority requires this distinction)
- Exam presence/check-in is not equal to general school attendance.

## 7. SYSTEM-LEVEL DEPENDENCY BOUNDARIES

Cross-domain interaction must respect source-domain ownership and use explicit approved contracts.

Technical choices including sync vs async, API style, event delivery, broker technology, payload shape, and contract implementation remain deferred to later Architecture Sequence 5 unless an upstream invariant explicitly requires a non-blocking boundary. 

For Secure Assessment, we preserve only the required high-level failure-isolation/non-blocking obligations already supported by canonical sources.

## 8. SPECIFIC DOMAIN RESPONSIBILITY RULES

- **School Operating System:** 
  - **Academic Core** is the minimum shared academic truth and is NOT a full SIS/ERP. 
  - **Learn** is OPTIONAL. 
  - **Student Administration** remains a FUNCTIONAL MODULE inside School Operating System. It manages student lifecycle workflows within school context, and DOES NOT silently become an independent source of academic truth where Academic Core already owns canonical Enrollment and student academic lifecycle truth.
  - **School Insight** remains a FUNCTIONAL MODULE inside School Operating System. It consumes derived / aggregated data, is never master data, and cannot directly correct source records. Assessment analytics remain non-source truth and must not destabilize active assessment.
  - **Parent / Guardian** is a FUNCTIONAL MODULE / authorized access and projection boundary. It DOES NOT own academic truth, directly modify Academic Core truth, impersonate the Student, or receive unrestricted student data. Guardian access is relationship-scoped, authorization-aware, and limited to explicitly permitted data. Guardian interaction with Care occurs only through authorized Care workflows; Care records are not assumed to be generally visible to Guardians. Guardian verification mechanics remain OPEN.
  - General school timetable and general school attendance are OUT OF CURRENT BASELINE.
- **Track:** Longitudinal academic development and progress tracking (e.g. Academic Progress, Early Warning, Targets / Follow-Up, Portfolio Workbench). Track != Care. Track does not own credentials. Track does not own Secure Assessment scoring. Track does not imply or own Official School Grade truth.
- **Passport:** The trusted portable representation of governed student identity/evidence/history/developmental records, with provenance and controlled visibility according to upstream maturity. Profile != Portfolio != Passport. Application Snapshot != live Passport. Passport trust rules remain PROVISIONAL.
- **Path:** Future planning, goals, readiness direction, action planning, and post-school pathway/opportunity exploration. Path != Opportunity. Goal != Target != Action. Readiness != Eligibility. Relevant != Eligible != Recommended. Path formula remains OPEN.

## 9. SECURE ASSESSMENT MISSION-CRITICAL ISOLATION BOUNDARY

Secure Assessment is the mission-critical core. Active exams must not be destabilized by noncritical domain failure.

- **Critical Dependencies:** Identity/Auth, Assessment Core, Answer Persistence, Timer Authority, Submission, and Essential Security.
- **Degradable Noncritical Capabilities:** Track, Insight, Partner, Billing, Search, Messaging, and Noncritical Notification. These must not become required synchronous dependencies that can take down active assessment.

Mechanisms (No Lost Answers persistence, server timers, idempotency, internal models, infrastructure/failover) belong to later Architecture Sequences.

## 10. TENANT AND PRIVACY BOUNDARY CONSTRAINTS

Tenant boundaries are constrained as follows:
- One school = one academic tenant baseline.
- Organization != Tenant.
- No implicit cross-tenant authorization.
- Student data is private by default.
- Care data is highly restricted.
- Partner access is purpose-limited and authorization/consent-aware.
- No unrestricted Partner student search.

Database tenancy strategy, permission matrices, and authentication implementations are deferred.

## 11. PRODUCTION BLOCKER ARCHITECTURE BOUNDARY HOOKS

Status: TOTAL 12 | OPEN / CARRIED FORWARD 12 | RESOLVED / CLOSED 0

- **PB-01 Controller / Processor Legal Allocation:** Relevant boundary constraint.
- **PB-02 Final Retention Periods / Retention Matrix:** Preserved for later Architecture Sequence.
- **PB-03 Required DPIA:** Relevant boundary constraint.
- **PB-04 Full Authentication Policy / Authentication-Security Policy:** Preserved for later Architecture Sequence.
- **PB-05 Permission Matrix:** Preserved for later Architecture Sequence.
- **PB-06 Assessment Capability Testing:** No direct Sequence 1 design effect.
- **PB-07 Zero-Lost-Answer Verification:** Preserved for later Architecture Sequence.
- **PB-08 Care Safeguarding Rules / Policy:** Relevant boundary constraint.
- **PB-09 Partner Verification / Moderation Policy:** Relevant boundary constraint.
- **PB-10 Data Classification + Consent Governance:** Preserved for later Architecture Sequence.
- **PB-11 Backup + Restore Verification:** Preserved for later Architecture Sequence.
- **PB-12 Security / Incident-Response Readiness:** Preserved for later Architecture Sequence.

## 12. OPEN / PROVISIONAL / FUTURE SAFETY BOUNDARIES

- **Discipline placement (OPEN):** Boundary implication: Do not place. Prohibited assumption: Exists in baseline flow.
- **Higher-education source strategy (OPEN):** Boundary implication: Maintain ecosystem boundary without mapping source strategy. Prohibited assumption: Belongs to Connect.
- **Passport trust rules (PROVISIONAL):** Boundary implication: Isolate Passport boundary. Prohibited assumption: Unverified Profile data = Passport.
- **Early Warning rules (OPEN):** Boundary implication: Boundary separation from Care. Prohibited assumption: Defined rules.
- **Path formula (OPEN):** Boundary implication: Separation from Opportunity. Prohibited assumption: Match guarantees placement.
- **Care safeguarding mechanics (OPEN):** Boundary implication: Strict Care boundary. Prohibited assumption: Uniform access.
- **Talent Assurance mechanism (FUTURE / PROVISIONAL):** Boundary implication: Do not create operational domain. Prohibited assumption: Active baseline.
- **AI capabilities (FUTURE):** Boundary implication: Do not design AI integration boundaries. Prohibited assumption: AI is baseline.
- **E-Rapor (FUTURE):** Boundary implication: Limit Academic Core to minimum shared truth. Prohibited assumption: Academic Core is full SIS/E-Rapor.

## 13. EXPLICIT SEQUENCE 1 NON-GOALS AND DEFERRALS

- **SEQUENCE 2:** tenant isolation implementation, physical data architecture, data ownership mechanics, provenance mechanics, consistency/transaction mechanics, lifecycle continuity implementation.
- **SEQUENCE 3:** Person/User/Membership technical implementation, authorization architecture, authentication architecture, permission mechanics, security enforcement implementation.
- **SEQUENCE 4:** Secure Assessment internal critical Architecture, No Lost Answers mechanisms, timer mechanics, idempotency mechanics, participant/attempt/session internal architecture, immutable snapshot implementation.
- **SEQUENCE 5:** technical cross-domain contract implementation, API/event contract details, external integration implementation boundaries.
- **SEQUENCE 6:** runtime topology, deployment topology, observability mechanics, backup/restore architecture, incident-response mechanics, technology-selection criteria, migration/bootstrap implementation.
- **SEQUENCE 7:** Architecture traceability, Architecture exit gate, Build-entry eligibility.

## 14. DATABASE / TECHNOLOGY MATURITY SAFEGUARD

Upstream canonical direction permits an initial modular-monolith / controlled shared-database approach with strict logical domain ownership where applicable.

However, Sequence 1 **does NOT select:**
- PostgreSQL / Postgres as the final Architecture database engine
- physical database layout
- schema strategy
- cross-domain FK strategy
- framework
- programming language
- frontend/backend stack
- auth provider
- API technology
- message broker
- cloud/vendor
- deployment topology

## 15. SEQUENCE 1 OPEN QUESTIONS / LATER REVIEW ITEMS

No genuine Sequence 1 open system/domain boundary questions remain at this time.

## 16. LOCK EXIT CHECKLIST

- [x] covers system context
- [x] covers canonical logical domains
- [x] preserves source-of-truth ownership
- [x] preserves Shared Platform Core boundaries
- [x] preserves Secure Assessment mission-critical isolation
- [x] preserves tenant/privacy boundary constraints
- [x] preserves canonical distinctions
- [x] keeps PB-01 through PB-12 open
- [x] preserves OPEN/PROVISIONAL/FUTURE maturity
- [x] avoids technology selection
- [x] avoids ERD/schema/API leakage
- [x] avoids later Sequence leakage
- [x] leaves Build unauthorized



