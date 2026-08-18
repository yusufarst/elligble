# ELLIGBLE Data, Tenancy, and Trust Architecture

**Status:** LOCKED
**Version:** 1.0.0
**Phase:** ARCHITECTURE
**Architecture Sequence:** SEQUENCE 2 - DATA / TENANCY / TRUST ARCHITECTURE
**Artifact Type:** ARCHITECTURE
**Canonical:** YES
**Architecture Unit ID:** NONE
**Architecture Unit Naming Convention:** NOT YET ESTABLISHED
**Build:** NOT AUTHORIZED

## 1. PURPOSE AND AUTHORITY

This is Architecture Sequence 2. It refines the HOW-level data, tenancy, and trust architecture. It is LOCKED and canonical and does not supersede other LOCKED or FROZEN authoritative sources. It does not authorize Build.

## 2. DATA OWNERSHIP ARCHITECTURE

- **Canonical Source-of-Truth Ownership:** One domain strictly owns the canonical truth for any specific bounded context.
- **Owner-Domain Mutation Authority:** Only the owning domain possesses the architectural authority to mutate its canonical data.
- **Consumer / Projection Boundaries:** Consumers may read, project, or aggregate data, but these projections must not be treated as canonical truth.
- **Shared Capabilities:** Shared capabilities may own only records within their canonical scope.
- **Cross-Domain Writes:** No silent cross-domain writes are permitted. All cross-domain interactions must occur through explicit architectural contracts.
- **Derived Data Safeties:** Derived data must not silently become owner truth.
- **Duplicate Ownership:** Duplicate canonical ownership is strictly prohibited.

## 3. TENANT ISOLATION ARCHITECTURE

- **Baseline Constraint:** One school equals one academic tenant baseline.
- **Organization vs Tenant:** Organization != Tenant. An Organization relationship must not imply unrestricted cross-tenant data access.
- **Tenant Isolation:** Tenant-scoped data remains strictly isolated.
- **Contextual Operations:** Every tenant-scoped read/write/use must operate under explicit, valid tenant context at the architectural level.
- **Person Continuity Bypass Prevention:** Global Person continuity must not become a cross-tenant access bypass.
- **Cross-Tenant Exposure:** Cross-tenant exposure must be explicit, purpose-bounded, minimum-necessary, and authorized by later access/policy architecture (Sequence 3).
- **Physical Strategy Deferral:** This architecture does NOT choose schema-per-tenant, database-per-tenant, row-level security, shared-schema implementation, or physical database layout.

## 4. PERSON / MEMBERSHIP / LIFECYCLE DATA CONTINUITY

- **Person Identity Preservation:** Do not duplicate Person merely because account, membership, or school context changes. Person != User Account != Membership.
- **Account Independence:** Account state does not redefine Person identity. Person continuity is not User Account continuity.
- **Membership Scope:** Membership is a contextual tenant participation. Membership history does not overwrite global Person continuity.
- **Student to Alumni Continuity:** Student -> Alumni is a lifecycle transition/context change, not a new Person. It preserves Person lifecycle continuity.
- **Historical Context:** Historical tenant context remains distinguishable from current context.

## 5. CANONICAL VS DERIVED STATE

- **Authoritative Rule:** The canonical source owner remains authoritative at all times.
- **Mutation Rules:** A derived projection cannot silently mutate canonical truth.
- **Freshness Rule:** Derived state freshness does not redefine source truth.
- **Corruption Prevention:** Projection failure or staleness must not corrupt the canonical owner state.
- **Privacy Enforcement:** Access to a projection remains subject to authorization and privacy recheck in later architecture where required.

## 6. PROVENANCE AND TRUST

- **Identity and Domain:** Provenance must capture the source identity and originating domain.
- **Lineage:** Evidence and source lineage must be preserved where trusted history requires it.
- **Observation Context:** Capture or observation context must be recorded where canonically necessary.
- **State Distinctions:** Current/live state must be distinguished from historical snapshots.
- **Trust Claims Traceability:** Trust claims must be traceable to their originating source.
- **Passport Evidence:** Passport governed evidence and history must be maintained.
- **Application Snapshots:** Application Snapshot is immutable and distinct from the live Passport.

## 7. HISTORICAL CONTINUITY

Architecture must preserve distinctions between:
- Current state
- Past valid state
- Historical evidence
- Immutable application snapshot
- Membership/lifecycle history
- Graduation/transfer continuity

This sequence does not invent retention periods.

## 8. CONCEPTUAL CONSISTENCY BOUNDARIES

- **Canonical Invariants:** Owner-domain canonical invariants must be strictly maintained within their domain.
- **Cross-Domain Consistency:** Cross-domain dependency on canonical source truth must respect the owner's consistency boundary.
- **Freshness vs Correctness:** Derived/projection freshness is explicitly distinct from source correctness.
- **Snapshot Integrity:** Immutable snapshot integrity must be guaranteed by the owning domain.
- **Historical Continuity Consistency:** Historical continuity consistency must be preserved across lifecycle transitions.
- **Tenant Consistency:** Tenant-isolation consistency must be enforced conceptually.

**Disclaimer:** Sequence 2 explicitly does NOT select distributed transactions, eventual-consistency technology, synchronous implementation, asynchronous implementation, outbox, CDC, event sourcing, CQRS, message broker, or transaction framework. Exact cross-domain contract mechanism remains Sequence 5.

## 9. PRIVACY / DATA CLASSIFICATION / CONSENT HOOKS

Architecture must preserve:
- Student data is private by default.
- Minimum necessary data principles apply.
- Care data remains highly restricted.
- Partner data access is strictly purpose-limited. Partner cannot unrestrictedly search students.
- Consent and data-classification enforcement hooks must be supported.

This does NOT claim PB-10 closure. This does NOT invent a final data-classification matrix or consent policy.

## 10. RETENTION / DELETION ARCHITECTURE HOOKS

Architecture must permit future retention/deletion policy enforcement hooks.
It does NOT invent retention periods, legal conclusions, deletion schedules, or controller/processor allocation.
PB-01, PB-02, and PB-03 remain OPEN / CARRIED FORWARD; Sequence 2 provides architecture hooks without resolving their policy or legal closure.

## 11. SECURE ASSESSMENT DATA/TRUST BOUNDARY

Sequence 2 establishes the data/trust principles needed by later Sequence 4, preserving:
- Assessment Score != Official School Grade.
- Question Bank Item != immutable Exam Question Snapshot.
- Student != Exam Participant != Exam Attempt != Exam Session.
- Secure Assessment remains mission-critical.
- Sequence 2 must not destabilize or redesign Sequence 4 internals.

Sequence 2 does NOT design No Lost Answers mechanisms, answer persistence algorithms, timer mechanisms, submission idempotency mechanisms, or runtime attempt/session implementation. Those belong to Sequence 4.

## 12. CROSS-SEQUENCE HANDOFFS

- **Sequence 3 (Identity / Access / Security Architecture):** Receives data ownership rules, tenant isolation rules, and Person/Membership continuity structures to implement scoped authorization, privacy enforcement, and authentication.
- **Sequence 4 (Secure Assessment Critical Architecture):** Receives data trust boundaries and conceptual consistency requirements to design mission-critical persistence and timer authority.
- **Sequence 5 (Cross-Domain & Integration Architecture):** Receives data ownership and consistency boundaries to design exact cross-domain API/event contracts.
- **Sequence 6 (Runtime / Reliability / Operations Architecture):** Receives data continuity and isolation hooks to inform observability, failure recovery, and backup/restore requirements.
- **Sequence 7 (Architecture Traceability & Exit Gate):** Receives this artifact's requirements for traceability verification.

## 13. PRODUCTION BLOCKER PRESERVATION

- **PB-01 Controller / Processor Legal Allocation:** OPEN / CARRIED FORWARD. Sequence 2 establishes data ownership rules that serve as input to legal allocation.
- **PB-02 Final Retention Periods / Retention Matrix:** OPEN / CARRIED FORWARD. Sequence 2 establishes retention architectural hooks without inventing periods.
- **PB-03 Required DPIA:** OPEN / CARRIED FORWARD. Sequence 2 establishes data boundaries as input to DPIA.
- **PB-04 Full Authentication Policy / Authentication-Security Policy:** OPEN / CARRIED FORWARD. Sequence 2 establishes consistency rules; enforcement is Sequence 3.
- **PB-05 Permission Matrix:** OPEN / CARRIED FORWARD. Sequence 2 establishes data ownership; scoped mapping is Sequence 3.
- **PB-06 Assessment Capability Testing:** OPEN / CARRIED FORWARD. Sequence 2 provides conceptual boundaries for testable capabilities.
- **PB-07 Zero-Lost-Answer Verification:** OPEN / CARRIED FORWARD. Sequence 2 provides trust boundaries; mechanism is Sequence 4.
- **PB-08 Care Safeguarding Rules / Policy:** OPEN / CARRIED FORWARD. Sequence 2 establishes privacy boundaries for restricted Care data access hooks.
- **PB-09 Partner Verification / Moderation Policy:** OPEN / CARRIED FORWARD. Sequence 2 establishes purpose-limited boundary hooks for Partner data.
- **PB-10 Data Classification + Consent Governance:** OPEN / CARRIED FORWARD. Sequence 2 establishes classification and consent architectural hooks.
- **PB-11 Backup + Restore Verification:** OPEN / CARRIED FORWARD. Sequence 2 establishes isolation hooks; mechanism is Sequence 6.
- **PB-12 Security / Incident-Response Readiness:** OPEN / CARRIED FORWARD. Sequence 2 establishes isolation hooks; mechanism is Sequence 6.

**RESOLVED / CLOSED:** 0

## 14. OPEN / PROVISIONAL / FUTURE SAFETY

- **Controller / Processor Legal Allocation (PB-01):** OPEN. Sequence 2 establishes ownership, not legal allocation. Do not assume legal roles.
- **Final Retention Periods (PB-02):** OPEN. Sequence 2 defines hooks, not schedules. Do not assume periods.
- **Data Classification + Consent Governance (PB-10):** OPEN. Sequence 2 defines hooks, not matrices. Do not assume matrix closure.
- **Care Safeguarding Rules / Policy (PB-08):** OPEN. Sequence 2 bounds data access, does not resolve policy. Do not assume policy closure.
- **Passport Trust-Level Rules:** PROVISIONAL. Sequence 2 requires provenance, but does not finalize specific trust mechanisms. Do not assume final trust mechanics.
- **Cross-Domain FK / Event Strategy:** PROVISIONAL. Sequence 2 prohibits silent writes, but defers mechanism to Sequence 5. Do not assume synchronous vs asynchronous strategy.
- **Specific Technology/Schema Strategy:** PROVISIONAL. Sequence 2 defines logical isolation and ownership, not physical schema layout. Do not assume specific implementation.
- **AI Capabilities:** FUTURE. Sequence 2 preserves data scope; does not implement AI. Do not elevate AI to in-scope.

*(Note: Prior unsupported LPTPAT claims are explicitly excluded and not introduced.)*

## 15. EXPLICIT NON-GOALS / TECHNOLOGY SAFEGUARD

This architecture does NOT select or define:
- PostgreSQL or another database engine.
- Physical schema.
- Tables.
- Columns.
- Primary keys.
- Foreign keys.
- Schema-per-tenant.
- Database-per-tenant.
- Row-level security implementation.
- Cross-domain FK strategy.
- ORM.
- RBAC.
- ABAC.
- Token/session mechanism.
- API endpoint contracts.
- Event schemas.
- Event bus.
- Broker.
- CQRS.
- Event sourcing.
- Outbox.
- CDC.
- Cache technology.
- Programming language.
- Framework.
- Cloud/vendor.
- Deployment topology.
- Migration scripts.

## 16. SEQUENCE 2 OPEN QUESTIONS / LATER REVIEW ITEMS

- NONE (No unresolved architecture questions are exposed by this substantive design at the current stage without violating bounded scope).

## 17. LOCK EXIT CHECKLIST

- [x] covers data ownership
- [x] covers logical tenant isolation
- [x] preserves Organization != Tenant
- [x] preserves Person/User Account/Membership separation
- [x] covers lifecycle continuity
- [x] covers canonical vs derived state
- [x] covers provenance/trust
- [x] covers historical continuity
- [x] covers conceptual consistency boundaries
- [x] preserves privacy/Care/Partner constraints
- [x] provides PB-02/PB-10 and other applicable hooks without closure
- [x] keeps all 12 Production Blockers open
- [x] preserves OPEN / PROVISIONAL / FUTURE maturity
- [x] avoids Sequence 3 leakage
- [x] avoids Sequence 4 leakage
- [x] avoids Sequence 5 leakage
- [x] avoids Sequence 6 leakage
- [x] avoids ERD/schema/API work
- [x] avoids technology selection
- [x] leaves Build unauthorized
