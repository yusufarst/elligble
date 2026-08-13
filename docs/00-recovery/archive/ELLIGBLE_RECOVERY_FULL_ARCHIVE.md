# ELLIGBLE — Master Recovery Index

**Document ID:** REC-00.00  
**Document Type:** Recovery / Consolidation Index  
**Status:** FROZEN RECOVERY ARCHIVE  
**Version:** 1.0.0  
**Owner:** ELLIGBLE Platform Owner  
**Purpose:** Mengumpulkan kembali keputusan, fitur, ide, legacy implementation, technical direction, dan open questions ELLIGBLE sebelum Master Blueprint dikunci.  
**Rule:** Dokumen ini bukan final PRD. Setiap item harus direview dan dipindahkan ke dokumen discovery/domain yang sesuai sebelum dianggap final implementation specification.

---

# 1. Recovery Status Legend

Gunakan status berikut untuk seluruh item:

## LOCKED
Keputusan sudah ditetapkan untuk baseline ELLIGBLE saat ini.

## PROVISIONAL
Arah sudah cukup jelas tetapi detailnya masih harus melalui discovery.

## OPEN
Belum diputuskan atau belum cukup aman untuk dikunci.

## FUTURE
Harus dipertimbangkan arsitekturnya sejak awal tetapi implementasinya bukan prioritas build awal.

## LEGACY
Berasal dari project/implementation sebelumnya dan harus dievaluasi sebelum di-port.

## REJECTED
Pernah dipertimbangkan tetapi tidak digunakan pada baseline saat ini.

---

# 2. Canonical Product Identity

| Item | Status | Recovery Decision |
|---|---|---|
| Product name | LOCKED | **ELLIGBLE** |
| Product type | LOCKED | Multi-tenant education superapp |
| Primary tenant | LOCKED | SMA/SMK/MA/MAK dan sederajat |
| Pilot/reference tenant | LOCKED | SMA N 1 Mlati |
| Platform ownership | LOCKED | ELLIGBLE Platform Owner mengelola platform, bukan menjadi admin tenant biasa |
| SMP/MTs | REJECTED as tenant | Tidak menjadi target tenant karena berada di bawah jenjang SMA |
| Perguruan tinggi | LOCKED as partner direction | Tidak menjadi tenant akademik utama; dapat menjadi partner pada jalur masa depan siswa |
| Legacy CBT/Kusuma | LEGACY | Sumber pembelajaran dan implementation reference, bukan identitas produk final |

---


# 2A. RECOVERY-R2.1 Review Outcome — Product Identity

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.1  
**Owner Approval:** APPROVED

The following decisions have been explicitly reviewed and approved by the Platform Owner:

## R2.1-01 — Product Identity

**Decision:** LOCKED

ELLIGBLE is a:

> **Multi-tenant education superapp**

ELLIGBLE is not positioned merely as:

- CBT;
- LMS;
- school administration software;
- exam-only platform.

Assessment, learning, school operations, student development, networking, and future pathways are parts of one integrated ELLIGBLE ecosystem.

---

## R2.1-02 — Primary Academic Tenant

**Decision:** LOCKED

Primary academic tenants are:

```text
SMA
SMK
MA
MAK
dan jenjang sederajat
```

SMP/MTs are not part of the current primary academic tenant scope.

---

## R2.1-03 — SMA N 1 Mlati Position

**Decision:** LOCKED

SMA N 1 Mlati is:

```text
Pilot Tenant
Reference Tenant
Initial Validation Environment
```

SMA N 1 Mlati is NOT:

```text
ELLIGBLE product identity
a hardcoded tenant
a special-case architecture baseline
```

Core modules, data model, permissions, navigation, configuration, and branding architecture must remain reusable for other schools.

---

## R2.1-04 — Partner & Opportunity Ecosystem

**Decision:** LOCKED — EXPANDED

Institutions outside the primary SMA/sederajat tenant model do not become academic school tenants by default.

They may participate through:

> **ELLIGBLE Partner & Opportunity Ecosystem**

Candidate ecosystem categories:

```text
HIGHER EDUCATION
├── Universitas
├── Institut
├── Sekolah Tinggi
├── Politeknik
└── Akademi

CAREER
├── Perusahaan
├── Recruiter
├── HR / Talent Partner
├── Penyedia Magang
└── Career Opportunity Provider

SCHOLARSHIP
├── Pemerintah
├── Yayasan
├── Perusahaan
└── Institusi Pendidikan

SKILL & CERTIFICATION
├── Lembaga Pelatihan
├── Bootcamp
├── Lembaga Sertifikasi
└── Professional Training Provider

ENTREPRENEURSHIP
├── Inkubator Bisnis
├── Accelerator
├── Mentor
├── Franchise / Business Opportunity
├── UMKM Ecosystem
└── Business Support Provider

COMMUNITY & DEVELOPMENT
├── Organisasi
├── Komunitas Profesional
├── Volunteer Opportunity
└── Youth Development Program

RELEVANT MERCHANT / SERVICE
├── Produk Pendidikan
├── Career Services
├── Training Services
└── Layanan Relevan Lainnya
```

Boundary:

> **Partner ≠ School Tenant**

Partner access must not imply unrestricted access to student data.

Target consent-oriented flow:

```text
Partner Registration
↓
ELLIGBLE Verification
↓
Approved Partner
↓
Publish Opportunity / Program
↓
Student Discovers Opportunity
↓
Student Explicitly Opts In / Applies
↓
Only Permitted Data Is Shared
```

Partner profile may later contain:

```text
Logo
Organization Name
Partner Type
Verification Badge
Description
Location
Website
Programs / Opportunities
Scholarships
Jobs
Internships
Training
Events
Trust Signals
Contact Channel
```

Final partner verification, monetization, ranking, consent, data-sharing scope, moderation, and trust model remain subject to later dedicated discovery.

---

## R2.1-05 — Post-Graduation Continuity

**Decision:** LOCKED

Student identity does not end at graduation.

Conceptual transition:

```text
Student
↓
Graduate
↓
Alumni
```

The ELLIGBLE account and Passport are intended to continue after graduation.

Potential continuing capabilities include:

```text
Passport
Path
Networking
Opportunity Discovery
Mentorship
Alumni Community
Contribution Back to School / Ecosystem
```

Detailed alumni permissions and post-graduation data policy remain subject to later discovery.

---

## R2.1 Consolidated Result

```text
R2.1-01 Product Identity                    → LOCKED
R2.1-02 Primary Academic Tenant            → LOCKED
R2.1-03 SMA N 1 Mlati Position             → LOCKED
R2.1-04 Partner & Opportunity Ecosystem     → LOCKED — EXPANDED
R2.1-05 Post-Graduation Continuity          → LOCKED
```

These decisions supersede any conflicting older recovery assumptions.

---

# 3. Long-Term Product Purpose

## 3.1 Core Purpose

**Status: LOCKED**

ELLIGBLE tidak berhenti sebagai CBT atau sistem operasional sekolah.

ELLIGBLE dibangun sebagai platform yang mendampingi siswa selama masa SMA dan menjadi bridging menuju kehidupan setelah lulus.

Lifecycle konseptual:

```text
MASUK SMA
↓
Belajar
↓
Dinilai
↓
Dipantau
↓
Membangun Profile / Passport
↓
Mengembangkan kompetensi dan jejaring
↓
LULUS
↓
Memilih jalur masa depan
├── Kuliah
├── Kerja
├── Bisnis / Wirausaha
├── Pelatihan / Sertifikasi
└── Peluang relevan lainnya
↓
Alumni
↓
Dapat kembali berkontribusi ke ekosistem
```

---


# 3A. RECOVERY-R2.2 Review Outcome — Product Purpose

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.2  
**Owner Approval:** APPROVED

The following product-purpose decisions have been explicitly reviewed and approved by the Platform Owner.

---

## R2.2-01 — End-to-End Student Journey and Unemployment Reduction

**Decision:** LOCKED — EXPANDED

ELLIGBLE is intended to unite the student journey during senior-secondary education into one connected ecosystem:

```text
Belajar
↓
Dinilai
↓
Dipantau
↓
Dibimbing
↓
Membangun Profile / Passport
↓
Membangun Kompetensi
↓
Membangun Jejaring
↓
Menentukan Arah Masa Depan
↓
Terhubung ke Opportunity Nyata
```

ELLIGBLE must not stop at helping students complete school.

A broader intended impact is:

> **Membantu siswa memiliki arah masa depan yang lebih jelas dan, dalam jangka panjang, berkontribusi pada pengurangan pengangguran melalui transisi yang lebih baik dari sekolah menuju pendidikan lanjut, pekerjaan, kewirausahaan, pelatihan, sertifikasi, dan peluang relevan lainnya.**

Conceptual impact chain:

```text
Student Data + Development History
↓
Better Self-Understanding
↓
Clearer Future Direction
↓
Relevant Guidance
↓
Relevant Opportunity Matching
↓
Better Transition After Graduation
↓
Higher Chance of Productive Education / Employment / Entrepreneurship
```

ELLIGBLE does not guarantee employment outcomes.

The platform's responsibility is to improve:

- visibility of options;
- student readiness;
- verified development records;
- access to relevant opportunities;
- transition planning;
- partner discoverability;
- connection between schools, students, alumni, and external opportunity providers.

Future impact measurement may include:

```text
Graduate destination clarity
Higher-education continuation
Employment transition
Internship participation
Certification participation
Entrepreneurship participation
Time-to-first-opportunity
Alumni tracer indicators
```

Final impact KPI definitions remain subject to later discovery.

---

## R2.2-02 — ELLIGBLE as School Operating Platform

**Decision:** LOCKED — EXPANDED

ELLIGBLE is not only a student-facing application.

ELLIGBLE is also intended to become a:

> **School Operating Platform for senior-secondary education**

The platform should progressively unify relevant school operations such as:

```text
Academic Structure
Learning
Assessment
Student Monitoring
Counseling / Care
Parent Engagement
Communication
Notifications
Reporting
Analytics / Insight
Administration
Future Pathway Preparation
```

The purpose is not to force every school process into one monolithic module.

Instead, ELLIGBLE should provide:

```text
Shared Identity
Shared Academic Context
Shared Permissions
Shared Student Record
Shared Notification Layer
Shared Audit Layer
Shared Analytics Foundation
Shared Integration Boundary
```

so modules can work together without creating duplicated or contradictory data.

### Critical Operating Boundary

The School Operating Platform must follow this rule:

> **Non-critical modules must never interfere with an active mission-critical Assessment runtime.**

Examples:

- feed outage must not stop an exam;
- partner service outage must not stop an exam;
- recommendation service outage must not stop an exam;
- analytics delay must not stop an exam;
- billing service outage must not cause answer loss;
- social/networking problems must not affect exam persistence;
- optional third-party integrations must not become hard dependencies of active assessment.

Architecture must later classify capabilities by criticality and dependency.

Candidate classification:

```text
MISSION CRITICAL
├── Authentication required for active exam access
├── Exam eligibility
├── Exam session
├── Answer persistence
├── Autosave / recovery
├── Submission
└── Required security controls

IMPORTANT
├── Proctor monitoring
├── Violation evidence
├── Notifications
└── Academic synchronization

NON-BLOCKING FOR ACTIVE EXAM
├── Feed
├── Social/network
├── Partner marketplace
├── Path recommendation
├── General analytics
└── Billing UI
```

Final service-boundary and failure-isolation architecture will be defined later.

---

## R2.2-03 — Secure Assessment as the Most Important and Urgent Flagship Engine

**Decision:** LOCKED — PRIORITY CRITICAL

Secure Assessment is the most important and urgent capability in the current ELLIGBLE build direction.

It is not merely an additional module.

It is a:

> **Flagship Engine and Mission-Critical Domain**

Assessment may also serve as an initial adoption entry point for schools before they activate broader ELLIGBLE capabilities.

### Non-Interference Rule

All other ELLIGBLE modules must be designed so they do not degrade or destabilize Assessment during active exam operation.

This means architecture must prioritize:

```text
Answer Persistence
Autosave
Reconnect
Submission Integrity
Session Recovery
Exam Eligibility
Security Events
Auditability
Tenant Isolation
```

over non-critical product experiences.

### Failure Isolation Principle

```text
ASSESSMENT CORE
must remain operational
even when non-critical modules are degraded
```

Examples of failures that must not cause active exam failure:

```text
Feed failure
Partner service failure
Recommendation failure
General analytics delay
Optional notification failure
Marketing/billing interface failure
Non-essential integration outage
```

The detailed service dependency map will be designed during architecture discovery.

---

## R2.2-04 — Passport as Long-Term Verified Student Development Record

**Decision:** LOCKED — EXPANDED

ELLIGBLE Passport is intended to become a long-term record of student development.

Potential verified components include:

```text
Identity Context
Skills / Competencies
Achievements
Portfolio
Certificates
Projects
Activities
Selected Academic Records
Learning Milestones
Assessment Evidence / Results where appropriate
Experience
Interests
Development History
```

Passport should help make a student's real development visible beyond a single exam score.

### Partner Use Case

With appropriate authorization and student consent, relevant verified Passport data may later be used by approved partners as one consideration for:

```text
Recruitment
Internship Selection
Scholarship Selection
Training Admission
Mentorship
University Opportunity
Other Verified Opportunity Matching
```

Important boundary:

> Partner access to Passport data is permission-based, purpose-limited, and must not mean unrestricted access to a student's complete private record.

A future consent model must define:

```text
What can be viewed
By whom
For what purpose
For how long
Whether the student approved it
Whether access is logged
Whether access can be revoked
```

Final Passport data model, verification levels, visibility levels, partner access, and consent flow remain subject to dedicated discovery.

---

## R2.2-05 — Path as the ELLIGBLE Bridging Engine

**Decision:** LOCKED — EXPANDED

ELLIGBLE has a core value of:

> **Bridging**

Path is the primary product engine that operationalizes this value.

Path must not be designed merely as a static recommendation page.

It should become the bridging layer between:

```text
WHO THE STUDENT IS
(Profile / Passport / Interests / Development)

+

WHERE THE STUDENT WANTS TO GO
(Goals / Preferences / Readiness)

+

WHAT OPPORTUNITIES EXIST
(Partner & Opportunity Ecosystem)

↓

ACTIONABLE TRANSITION PATH
```

Conceptual bridging flow:

```text
Student
↓
Self / Readiness Understanding
↓
Future Goal
↓
Recommended Path
↓
Action Plan
↓
Relevant Opportunities
↓
Application / Referral / Enrollment / Connection
↓
Transition Outcome
```

Primary bridge destinations remain:

```text
Kuliah
Kerja
Bisnis / Wirausaha
```

Potential supporting bridge destinations include:

```text
Beasiswa
Magang
Pelatihan
Sertifikasi
Mentorship
Komunitas
Program Pengembangan
```

The final matching engine, AI usage, recommendation logic, scoring, fairness, and partner-ranking rules remain subject to later discovery.

---

## R2.2-06 — Network Effect

**Decision:** LOCKED

ELLIGBLE is intended to gain ecosystem value as participation grows across:

```text
Schools
Students
Teachers
Parents
Alumni
Partners
Opportunity Providers
```

Conceptual network effect:

```text
More Schools
↓
More Students and Alumni
↓
Richer Verified Development / Passport Ecosystem
↓
More Valuable Partner Participation
↓
More Relevant Opportunities
↓
Higher Student Value
↓
Higher School Value
↓
More Ecosystem Participation
```

Network growth must not override:

- student privacy;
- tenant isolation;
- consent;
- safety;
- fairness;
- trust;
- relevance.

---

## R2.2 Consolidated Result

```text
R2.2-01 End-to-End Journey + Employment Impact      → LOCKED — EXPANDED
R2.2-02 School Operating Platform                   → LOCKED — EXPANDED
R2.2-03 Secure Assessment Flagship                  → LOCKED — PRIORITY CRITICAL
R2.2-04 Passport                                    → LOCKED — EXPANDED
R2.2-05 Path / Bridging Engine                      → LOCKED — EXPANDED
R2.2-06 Network Effect                              → LOCKED
```

These decisions supersede conflicting older recovery assumptions.

---

# 4. Product Pillars

## 4.1 School Operating Experience

**Status: LOCKED at concept level**

ELLIGBLE harus membantu aktivitas sekolah dan stakeholder utamanya.

Candidate domains:

```text
Core
Learn
Assess
Track
Care
Parent
Insight
Admin
```

Detail module masih melalui discovery.

---

## 4.2 Secure Assessment Engine

**Status: LOCKED**

Assessment merupakan salah satu pembeda utama ELLIGBLE.

Principles:

- zero-lost-answer;
- layered anti-cheating;
- evidence integrity;
- recoverability;
- proctor control;
- false-positive handling;
- weak-network handling;
- tenant isolation;
- auditability.

ELLIGBLE tidak boleh mengklaim sistem “100% mustahil dicurangi”.

Target approach:

```text
Prevention
+
Detection
+
Evidence
+
Risk Signals
+
Enforcement
+
Human Proctor Control
```

---

## 4.3 Future Bridge Ecosystem

**Status: LOCKED at concept level**

ELLIGBLE harus membantu siswa setelah lulus menuju:

- kuliah;
- kerja;
- bisnis/wirausaha;
- beasiswa;
- internship/magang;
- training;
- certification;
- opportunity lain yang relevan.

Ekosistem partner/merchant menjadi sisi supply dari bridge tersebut.

---


# 4A. RECOVERY-R2.3 Review Outcome — Product Pillars & Structural Model

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.3  
**Owner Approval:** APPROVED

This review expands the previous simplified “three-engine” model into a more complete product structure that preserves earlier ELLIGBLE/legacy concepts such as LMS, CBT, LPTPAT, School OS, Passport, Path, Partner, and the requirement for mission-critical Assessment isolation.

---

## R2.3-01 — Product Pillars Expanded Beyond Three Boxes

**Decision:** LOCKED — EXPANDED

ELLIGBLE should not be represented only as three broad boxes if doing so hides important bounded domains.

The current structural model is:

```text
ELLIGBLE PLATFORM
│
├── A. SHARED PLATFORM CORE
│   ├── Identity
│   ├── Tenant
│   ├── Academic Structure
│   ├── Permissions / RBAC
│   ├── Audit
│   ├── Notifications
│   ├── Search
│   ├── Integration Contracts
│   └── Platform Configuration
│
├── B. SCHOOL OPERATING SYSTEM
│   ├── Academic Operations
│   ├── Learn / LMS
│   ├── Student Administration
│   ├── Parent
│   ├── Care / Counseling
│   ├── Communication
│   └── School Insight
│
├── C. SECURE ASSESSMENT ENGINE
│   ├── CBT / Assess
│   ├── Question Bank
│   ├── Exam Builder
│   ├── Participant Management
│   ├── Exam Runtime
│   ├── Autosave / Recovery
│   ├── Scoring
│   ├── Anti-Cheating
│   ├── Evidence
│   └── Proctoring
│
├── D. ACADEMIC TRACKING & INTELLIGENCE
│   ├── LPTPAT
│   ├── Academic Records
│   ├── Longitudinal Progress
│   ├── Portfolio
│   ├── Early Warning
│   ├── Student Targets
│   ├── Counseling Signals
│   └── Academic Analytics
│
├── E. PASSPORT & TRUST LAYER
│   ├── Verified Student Record
│   ├── Achievement
│   ├── Competency
│   ├── Portfolio Evidence
│   ├── Certificate
│   ├── Provenance
│   └── Verification Status
│
├── F. BRIDGING / FUTURE PATH
│   ├── Path
│   ├── College
│   ├── Career
│   ├── Entrepreneurship
│   ├── Scholarship
│   ├── Internship
│   ├── Training
│   ├── Certification
│   └── Action Plan
│
├── G. PARTNER & OPPORTUNITY ECOSYSTEM
│   ├── Partner Verification
│   ├── Opportunity
│   ├── Recruitment
│   ├── Scholarship Selection
│   ├── Training / Certification
│   ├── Mentorship
│   └── Merchant / Relevant Services
│
├── H. VERIFIED CONNECTION & OUTCOME TRACKING
│   ├── Recruitment Connection
│   ├── Scholarship Connection
│   ├── Internship Connection
│   ├── Mentorship Connection
│   ├── Education Placement Connection
│   └── Outcome Tracking
│
└── I. ALUMNI & IMPACT
    ├── Alumni Transition
    ├── Graduate Outcome
    ├── Tracer
    ├── Mentoring
    ├── Contribution
    └── Impact Analytics
```

This is a **bounded-domain map**, not necessarily the final navigation menu.

The final user-facing navigation may be simpler.

---

## R2.3-01A — Learn / LMS Is a First-Class School OS Domain

**Decision:** LOCKED at concept level

The previously discussed LMS direction is preserved inside School OS as:

> **Learn / Learning Management**

Candidate scope:

```text
Digital Classroom
Learning Material
Assignment
Submission
Feedback
Discussion
Progress
Remedial
Enrichment
Learning Archive
```

Learn is not allowed to become a dependency that can destabilize live Assessment.

---

## R2.3-01B — CBT / Secure Assessment Is a Separate Mission-Critical Bounded Domain

**Decision:** LOCKED — PRIORITY CRITICAL

CBT is preserved as a dedicated bounded domain within the Secure Assessment Engine.

It owns mission-critical responsibilities such as:

```text
Question Delivery
Exam Session
Answer Persistence
Autosave
Reconnect
Submission
Scoring Flow
Anti-Cheating Events
Evidence
Proctor Controls
```

Other modules may consume Assessment outputs through approved contracts, but active CBT must not synchronously depend on non-critical modules.

---

## R2.3-01C — LPTPAT Is Preserved as Academic Tracking & Intelligence

**Decision:** LOCKED — RECOVERED & EXPANDED

Historical meaning:

> **LPTPAT = Layanan Portofolio dan Tracking Prestasi Akademik Transparan**

LPTPAT is preserved as an academic tracking/intelligence capability, not as a separate unrelated application.

Recovered capability direction includes:

```text
Academic Records
Academic Progress Dashboard
Longitudinal Tracking
Portfolio
Early Warning
BK / Counseling Support
Curriculum / Academic Analytics
Student Study Targets
Follow-Up
Decision Support
Deferred CBT Result Adapter
```

LPTPAT should use the shared academic master data and shared student identity.

However:

> **Shared data context does not mean runtime coupling.**

---

## R2.3-01D — CBT Priority Mode / LPTPAT Isolation

**Decision:** LOCKED as recovered architecture constraint

When CBT is in a live mission-critical exam state:

```text
CBT PRIORITY MODE = ACTIVE
```

LPTPAT must not create synchronous dependencies that can interfere with:

```text
Autosave
Anti-Cheating
Submit
Scoring
Exam Session
Answer Persistence
```

Historical isolation principle is preserved:

```text
LIVE CBT
↓
LPTPAT non-essential processing paused / locked / isolated
↓
CBT completes safely
↓
Final submission + scoring complete
↓
CBT priority lockdown released
↓
Approved asynchronous adapter may update LPTPAT / tracking data
```

Exact technical implementation will be decided later.

The core requirement is:

> **CBT safety has priority over LPTPAT freshness.**

---

## R2.3-02 — Passport Becomes a Credible, Verifiable Trust Layer

**Decision:** LOCKED — EXPANDED

Passport is not merely a profile containing self-entered achievements.

It must be designed so an approved partner can distinguish:

```text
Self-Declared
School-Verified
ELLIGBLE-System-Generated
Externally Verified
Assessment-Verified
Evidence-Backed
```

### Problem to Solve

The system must address the concern:

> “Apakah nilai/rekam jejak ini benar-benar kredibel, atau hanya dibaguskan oleh pihak sekolah/guru?”

Passport therefore requires a **provenance and verification architecture**.

### Proposed Trust Model

Each important record should be able to contain metadata such as:

```text
Record Type
Source
Issuer
Verification Level
Issued At
Verified At
Verification Method
Supporting Evidence
Original Value
Correction History
Audit Trail
Visibility
Consent Scope
Expiry / Validity if relevant
```

### Verification Levels — Candidate

```text
LEVEL 0 — SELF-DECLARED
Entered by student and not independently verified.

LEVEL 1 — SCHOOL-ISSUED
Entered/issued by an authorized school role.

LEVEL 2 — SCHOOL-VERIFIED + AUDITED
Issued through an approved workflow with issuer identity and audit trail.

LEVEL 3 — ELLIGBLE-VERIFIED
Generated or validated through ELLIGBLE-controlled processes.

LEVEL 4 — EXTERNAL-VERIFIED
Verified against an approved external issuer/provider.
```

Final naming and scoring remain subject to dedicated Passport discovery.

### Assessment-Based Credibility

ELLIGBLE Secure Assessment can become one stronger source of trusted evidence because relevant records may be backed by:

```text
Published exam snapshot
Participant eligibility
Recorded exam session
Answer history
Autosave history
Submission
Scoring
Audit trail
Anti-cheating evidence
Proctor events
```

This does not automatically make every assessment result “perfectly objective,” but it gives partners a clearer provenance than an unexplained manually entered number.

### Grade Inflation / Manipulation Mitigation — Candidate Controls

Potential future controls:

```text
Source transparency
Issuer identity
Role-based issuance
Immutable verified snapshots
Correction workflow instead of silent overwrite
Audit history
Assessment provenance
Evidence attachment
Cross-record consistency checks
Anomaly detection
Standardized / benchmark assessment where appropriate
Contextual performance information
External verification
```

### Partner View Principle

Partners should not see simply:

```text
Nilai: 95
```

without context.

A future partner view may instead show:

```text
Result
Source
Verification status
Issuer
Assessment type
Date
Evidence/provenance indicator
Relevant context
```

### No Unrestricted Partner Access

Passport credibility does not override privacy.

Partner access remains:

```text
Purpose-limited
Permission-based
Consent-aware
Audited
Revocable where applicable
```

---

## R2.3-03 — Connect Is NOT a Social Network

**Decision:** LOCKED — CHANGED

The previous “Connect as general networking/social graph” direction is superseded.

ELLIGBLE is not a social media platform.

`Connect` should be understood as:

> **Verified Relationship & Outcome Tracking**

A connection is created because a legitimate relationship or outcome exists, not because users casually follow each other.

### Example — Recruitment

```text
Partner publishes job
↓
Student applies / is considered
↓
Selection process
↓
Student passes recruitment
↓
Verified relationship created
↓
Student ↔ Partner become connected for the approved purpose
↓
Relevant progress/outcome can be tracked
```

### Other Candidate Scenarios

```text
Scholarship
Student selected
→ Verified Scholarship Connection

Internship
Student accepted
→ Internship Connection

Mentorship
Mentor + student both accept
→ Mentorship Connection

Training / Certification
Student enrolled through ELLIGBLE
→ Program Connection

Higher Education
Student accepted/enrolled through supported flow
→ Education Placement Connection
```

### Connection State — Candidate

```text
PENDING
VERIFIED
ACTIVE
COMPLETED
CANCELLED
EXPIRED
```

### Connection Permissions

A verified connection may enable only the capabilities needed for that relationship, for example:

```text
Status Tracking
Required Communication
Milestone Tracking
Document Exchange
Outcome Recording
Approved Passport Access
Feedback
Follow-Up
```

It does NOT automatically grant:

```text
Full student profile access
All Passport records
Permanent messaging
Access to school-private data
Access to unrelated students
```

### Product Placement

`Connect` may later be renamed if a clearer non-social term is identified.

The concept is locked; final label remains OPEN.

---

## R2.3-04 — Home Is an Operational Command Center, Not a Social Feed

**Decision:** LOCKED — CLARIFIED

Home remains a personalized command center.

ELLIGBLE is NOT positioned as a social media platform.

Therefore Home should prioritize:

```text
What needs attention
What is happening academically
What is upcoming
What requires action
What opportunity is relevant
What status has changed
What progress should be reviewed
```

Candidate student Home:

```text
Today's Schedule
Learning Tasks
Upcoming Assessment
Exam Readiness / Access
Academic Progress
Important School Announcement
Counseling / Follow-Up if permitted
Path Action
Relevant Opportunity
Application / Recruitment Status
Passport Completion
Notifications
```

Candidate teacher Home:

```text
Teaching Schedule
Class Activity
Assignments to Review
Upcoming Exams
Assessment Tasks
Student Alerts
Announcements
Required Actions
```

Candidate partner Home:

```text
Active Opportunities
Applicants
Selection Pipeline
Verified Connections
Required Actions
Outcome Tracking
```

### Feed Rule

An activity stream may exist for:

```text
Official announcement
System activity
Relevant updates
Opportunity updates
Academic updates
```

But default Home must not be optimized around:

```text
Likes
Followers
Viral posts
Infinite social scrolling
Engagement-for-engagement metrics
```

---

## R2.3-05 — Full Module Access for School Customers

**Decision:** LOCKED — CHANGED & EXPANDED

The previous assumption that schools may commercially activate individual modules is superseded as the default product principle.

Direction:

> **School customers should receive the full ELLIGBLE module ecosystem so product capability is fair across customers.**

This means commercial packaging should not intentionally create:

```text
School A gets essential student-development features
School B cannot access them only because its plan is lower
```

### Feature Flags Still Allowed

Feature flags may still be used for:

```text
Controlled rollout
Pilot testing
Beta features
Security mitigation
Technical compatibility
Regional/legal requirements
Incident response
Maintenance
```

but not as an automatic excuse for fragmented core product access.

### Pricing Remains OPEN

Commercial pricing may later differ based on areas such as:

```text
Tenant size
Usage volume
Storage
Support/SLA
Optional premium services
Partner services
Implementation services
```

However the fairness principle for core school modules is now locked.

---

## R2.3-06 — Integrated but Fault-Isolated Architecture

**Decision:** LOCKED — EXPANDED

ELLIGBLE modules must be:

> **Connected by design, isolated by failure domain.**

Modules should share approved platform foundations:

```text
Identity
Tenant
Academic Context
Permissions
Contracts
Events
Audit
Notification Infrastructure
Integration Boundaries
```

but a failure in one module must not automatically cascade into another.

Target principle:

```text
INTEGRATED DATA & WORKFLOW
+
LOOSE RUNTIME COUPLING
+
FAILURE ISOLATION
```

### Example

```text
Learn error
≠
Assess failure

Path error
≠
Passport corruption

Partner outage
≠
School OS outage

Analytics delay
≠
Transaction failure

LPTPAT processing issue
≠
CBT autosave failure
```

### Assessment Has Highest Isolation Priority

During active exam runtime:

```text
MISSION-CRITICAL ASSESSMENT PATH
```

must have the smallest possible dependency surface.

Non-critical services should communicate through:

```text
Asynchronous event
Deferred synchronization
Queue / outbox pattern
Read model
Adapter
Retryable integration
```

where appropriate.

Final technical patterns depend on architecture discovery and InsForge capability verification.

---

## R2.3 Consolidated Structural Model

The product is now better represented as:

```text
                    ELLIGBLE
                       │
        ┌──────────────┴──────────────┐
        │       SHARED PLATFORM       │
        │ Identity / Tenant / RBAC    │
        │ Academic / Audit / Contract │
        └──────────────┬──────────────┘
                       │
   ┌───────────────────┼────────────────────┐
   │                   │                    │
SCHOOL OS        SECURE ASSESSMENT    TRACKING / LPTPAT
   │                   │                    │
Learn/LMS          CBT Engine          Academic Intelligence
Parent             Anti-Cheating       Portfolio
Care               Proctoring          Early Warning
Operations         Scoring             Targets
   │                   │                    │
   └───────────────────┼────────────────────┘
                       │
               PASSPORT & TRUST
                       │
                 BRIDGING / PATH
                       │
              PARTNER ECOSYSTEM
                       │
        VERIFIED CONNECTION / OUTCOME
                       │
                 ALUMNI & IMPACT
```

Key rule:

> **The platform is integrated as one ecosystem, but critical capabilities—especially Assessment—must remain operational when unrelated modules degrade.**

---

## R2.3 Consolidated Result

```text
R2.3-01 Product Pillars / Bounded Domains        → LOCKED — EXPANDED
R2.3-01A Learn / LMS                             → LOCKED concept
R2.3-01B CBT / Secure Assessment                 → LOCKED — PRIORITY CRITICAL
R2.3-01C LPTPAT                                  → LOCKED — RECOVERED & EXPANDED
R2.3-01D CBT Priority Mode / LPTPAT Isolation    → LOCKED
R2.3-02 Passport Trust / Credibility             → LOCKED — EXPANDED
R2.3-03 Connect                                  → LOCKED — CHANGED
R2.3-04 Home                                     → LOCKED — CLARIFIED
R2.3-05 Full Module Access                       → LOCKED — CHANGED & EXPANDED
R2.3-06 Integrated but Fault-Isolated            → LOCKED — EXPANDED
```

These decisions supersede conflicting recovery assumptions.

---

# 5. Scale Assumptions

| Item | Status | Recovery |
|---|---|---|
| Commercial target | PROVISIONAL / strategic target | ±1.000 sekolah |
| Initial sizing assumption | PROVISIONAL | ±100 siswa per sekolah untuk estimasi awal |
| Architecture hard limit | REJECTED | Sistem tidak boleh dikunci pada 100 siswa per tenant |
| Scalability requirement | LOCKED | Harus mampu berkembang ke sekolah dengan jumlah siswa jauh lebih besar |
| Concurrency sizing | OPEN | Harus dihitung berdasarkan real exam concurrency dan traffic, bukan total account saja |

---


# 5A. RECOVERY-R2.4 Review Outcome — Scale, Tenant Identity, Organization Hierarchy & Platform Governance

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.4  
**Owner Approval:** APPROVED

This review expands the scale assumption, tenant identity model, multi-school organization structure, and Platform Owner governance so ELLIGBLE is not limited by the initial pilot or first commercial targets.

---

## R2.4-01 — Viral-Ready Scale, No Fixed Tenant Ceiling

**Decision:** LOCKED — EXPANDED

The previous “±1,000 schools” figure is no longer treated as a platform ceiling.

It is retained only as an early commercial/capacity planning milestone.

ELLIGBLE must be architected so growth can continue if adoption becomes much larger than expected.

Conceptual scale stages:

```text
PILOT
↓
EARLY ADOPTION
↓
1,000+ SCHOOLS
↓
NATIONAL SCALE
↓
VIRAL / HYPERGROWTH
```

The architecture must not contain business logic such as:

```text
MAX_TENANTS = 1000
MAX_STUDENTS_PER_TENANT = 100
```

unless a temporary operational safety limit is intentionally configured.

### Scale-Readiness Principles

Future architecture discovery must consider:

```text
Pagination
Cursor-based retrieval where appropriate
Efficient indexing
Background jobs
Asynchronous processing
Queue / outbox patterns
Rate limiting
Backpressure
Caching where safe
Connection management
Tenant-aware observability
Capacity testing
Horizontal scaling
Storage growth
Realtime fan-out
Exam concurrency
Graceful degradation
Failure isolation
```

### Critical Scale Rule

Capacity planning must focus on:

> **peak concurrent activity**, not merely total registered users.

For example:

```text
100,000 registered students
```

does not represent the same system load as:

```text
50,000 students simultaneously taking an exam
```

Assessment concurrency must therefore have its own capacity model.

### Viral Growth Principle

If ELLIGBLE adoption grows faster than expected:

- tenant identity must remain globally unique;
- new tenants must not require architecture changes;
- list/search APIs must not assume small datasets;
- admin UI must use search/filter/pagination rather than loading all records;
- background operations must avoid synchronous full-dataset scans;
- bulk jobs must be bounded, observable, and resumable;
- platform services must be decomposable when future scale requires it.

The final infrastructure topology remains subject to architecture discovery.

---

## R2.4-02 — Student Count Is a Planning Input, Not a Hard Limit

**Decision:** LOCKED

The previously used “±100 students per school” number is retained only as a rough early estimation input.

ELLIGBLE must support schools with:

```text
hundreds
thousands
or significantly larger student populations
```

without changing the fundamental tenant model.

Important cardinalities must not be hardcoded into:

```text
database constraints
UI assumptions
API limits
bulk operations
analytics
assessment participant logic
```

Operational limits may exist for safety/performance, but they must be configurable and not become hidden architectural ceilings.

---

## R2.4-03 — One Academic Institution = One Tenant + Globally Unique Tenant Identity

**Decision:** LOCKED — EXPANDED

Each school academic institution remains an independent tenant boundary.

However:

> **School name is never a canonical identifier.**

Multiple schools may legally or practically share identical or highly similar names.

Therefore every tenant must have an immutable globally unique internal identifier.

### Canonical Tenant Identity Model

Candidate identity fields:

```text
tenant_id
tenant_code
official_school_identifier
display_name
legal_name
education_type
country
province
regency_city
district
address
organization_group_id
status
created_at
```

### `tenant_id`

**Purpose:** canonical system identity.

Requirements:

- globally unique;
- immutable;
- never derived from school name;
- used for database ownership and foreign-key relationships;
- used for authorization/tenant isolation;
- not recycled after deletion/closure.

Exact technical format (UUID/UUIDv7/ULID/etc.) will be decided during technical architecture discovery.

### `tenant_code`

**Purpose:** human-operational lookup.

Candidate examples:

```text
ELL-SCH-000001
ELL-SCH-000002
```

or another controlled format.

Requirements:

- unique platform-wide;
- immutable or very tightly controlled;
- safe for support/operations lookup;
- not the primary security boundary.

### Official School Identifier

For Indonesian schools, an official identifier such as NPSN can be stored and validated where applicable.

However:

> Official external identifiers must not replace ELLIGBLE's internal `tenant_id`.

Reasons:

- external identifiers are owned by another system;
- data can be missing or corrected;
- external formats/policies can change;
- non-school organizations use different identifiers.

### Tenant Lookup Strategy

Lookup/search should support combinations such as:

```text
tenant_id
tenant_code
official_school_identifier
school name
province
regency/city
district
education type
```

Example:

```text
"SMA Negeri 1"
```

must not return an ambiguous single tenant without contextual information.

UI should display enough disambiguation context:

```text
SMA Negeri 1 — Sleman, DI Yogyakarta
SMA Negeri 1 — Bantul, DI Yogyakarta
SMA Negeri 1 — [other region]
```

### Data Ownership Rule

Every tenant-owned record must ultimately resolve to a canonical `tenant_id`.

Never use:

```text
school_name
school_slug
school_display_name
```

as the real ownership key.

---

## R2.4-04 — Multi-School Foundation / Organization Group Model

**Decision:** LOCKED — EXPANDED

A foundation, education group, or operator may manage multiple schools.

ELLIGBLE should support a hierarchy above school tenants without weakening tenant isolation.

Target conceptual model:

```text
PLATFORM
↓
ORGANIZATION GROUP / FOUNDATION
├── SCHOOL TENANT A
├── SCHOOL TENANT B
├── SCHOOL TENANT C
└── ...
```

### Core Rule

> **Each school remains its own tenant.**

A foundation does not collapse several schools into one shared tenant by default.

This preserves:

- independent academic structure;
- independent student data;
- independent permissions;
- independent audit trails;
- independent Assessment runtime;
- clean tenant isolation.

### Organization Group

An optional higher-level entity may represent:

```text
Foundation
Education Group
School Network
Operator
Corporate Education Group
Government/Institutional cluster where applicable
```

Candidate capabilities:

```text
Group-level dashboard
Cross-tenant aggregated analytics
Group user management
Shared policy templates
Shared branding assets
Shared configuration templates
Centralized subscription/billing
Group-level support
Approved cross-tenant reporting
```

### Cross-Tenant Access Rule

Organization-level users must not automatically receive unrestricted access to every student's raw data.

Access should be:

```text
Role-based
Scope-based
Purpose-limited
Audited
Explicitly granted
```

Possible access scopes:

```text
AGGREGATED_ONLY
TENANT_ADMIN
SELECTED_TENANTS
READ_ONLY
OPERATIONAL
AUDIT
```

Final scopes remain subject to RBAC discovery.

### Campus vs Tenant

Physical campus location and academic/legal tenant are different concepts.

One physical campus may host multiple academic institutions.

Therefore:

```text
Campus
≠
Tenant
```

A campus/location model may be introduced separately if needed.

---

## R2.4-05 — Platform Owner Is Above Tenants but Must Not Be an Uncontrolled Superuser

**Decision:** LOCKED — EXPANDED

ELLIGBLE Platform Owner exists above all tenants.

However:

> **Platform Owner must not become an unrestricted invisible superuser capable of silently changing any tenant/student record without accountability.**

The Platform Owner model must combine platform authority with anti-fraud and abuse controls.

### Platform Governance Layers

Candidate role separation:

```text
PLATFORM OWNER
↓
PLATFORM OPERATIONS
├── Tenant Operations
├── Support
├── Trust & Safety
├── Partner Verification
├── Billing Operations
└── Security Operations
```

Not every internal staff member receives Platform Owner privileges.

### High-Risk Actions

Examples:

```text
Changing tenant ownership
Changing privileged roles
Accessing private student data
Bulk data export
Impersonation
Changing verified Passport records
Deleting tenant data
Suspending a tenant
Changing billing state
Overriding security controls
Changing partner verification
Changing Assessment evidence
```

must receive stronger controls.

### Candidate Fraud / Abuse Controls

```text
Step-up authentication
MFA for privileged users
Device/session verification
Least privilege
Just-in-time elevated access
Time-bounded privileged sessions
Reason-for-access requirement
Immutable audit trail
Sensitive action event logging
Dual approval / maker-checker for selected actions
Export monitoring
Privilege-change alerts
Anomaly/risk detection
IP/device anomaly signals
Bulk-action limits
Break-glass procedure
Incident case management
Automatic session revocation
Account suspension
Tenant freeze where justified
Partner suspension
Evidence preservation
```

### Maker-Checker Principle

Certain high-risk actions should be able to require:

```text
PERSON A requests action
↓
PERSON B approves
↓
SYSTEM executes
↓
AUDIT records both identities
```

Candidate use cases:

- permanent data deletion;
- ownership transfer;
- high-impact privilege escalation;
- verified Passport correction;
- evidence deletion/override;
- partner verification override.

Final action list remains subject to security discovery.

### Anti-Fraud / Risk Console — Candidate

A future Platform Trust & Risk capability may monitor signals such as:

```text
Unusual admin login
Impossible/abnormal tenant switching
Large unexpected exports
Repeated permission escalation
Mass Passport edits
Suspicious partner behavior
Repeated failed privileged actions
Unusual support impersonation
Bulk grade/result corrections
Evidence tampering attempts
Abnormal API usage
```

Signals should generate:

```text
Risk Event
↓
Risk Score / Severity
↓
Review Case
↓
Action / Escalation
↓
Audit Outcome
```

### Platform Owner and Student Records

Platform Owner authority does not mean routine editing rights over academic truth.

For verified records, correction should follow a controlled workflow.

Preferred principle:

```text
CORRECT WITH HISTORY
```

rather than:

```text
SILENTLY OVERWRITE
```

This is especially important for:

- assessment result provenance;
- Passport credibility;
- certificates;
- partner selection records;
- fraud investigations.

### Support Impersonation / Tenant Access

If future support access requires acting as a tenant user:

```text
Explicit reason
Time limit
Audit log
Scope limit
Visible support session indicator where appropriate
No secret/password disclosure
Automatic expiry
```

Exact impersonation design remains OPEN until security/RBAC discovery.

---

## R2.4-06 — Tenant Branding Under ELLIGBLE Brand

**Decision:** LOCKED

Each school may have controlled tenant identity such as:

```text
School name
School logo
School profile
Address
Academic calendar
Selected configuration
Selected visual preferences
```

while remaining within the primary ELLIGBLE product identity.

Default principle:

> **ELLIGBLE remains the platform brand; the school is the tenant identity.**

This avoids turning the product into unrelated white-label products.

Final branding/white-label boundaries remain subject to business and design discovery.

---

## R2.4 Consolidated Result

```text
R2.4-01 Scale / Viral Readiness                    → LOCKED — EXPANDED
R2.4-02 Student Count Assumption                   → LOCKED
R2.4-03 Unique Tenant Identity                     → LOCKED — EXPANDED
R2.4-04 Foundation / Organization Group            → LOCKED — EXPANDED
R2.4-05 Platform Owner + Fraud/Risk Governance     → LOCKED — EXPANDED
R2.4-06 Tenant Branding                            → LOCKED
```

These decisions supersede conflicting older recovery assumptions.

---

# 6. Tenant Model

## 6.1 School Tenant

**Status: LOCKED**

Tenant utama:

```text
SMA
SMK
MA
MAK
dan jenjang sederajat
```

SMA N 1 Mlati hanya:

```text
Pilot Tenant
Reference Tenant
Initial Validation Environment
```

Tidak boleh ada:

- nama sekolah hardcoded;
- tenant-specific core business logic;
- tenant-specific database assumptions;
- branding SMA N 1 Mlati sebagai branding produk ELLIGBLE.

---

## 6.2 Tenant Isolation

**Status: LOCKED**

Tenant isolation harus ditegakkan pada trusted backend/database layer.

Minimum expectation:

```text
Tenant A → Tenant A data = ALLOW
Tenant A → Tenant B data = DENY
Unauthorized role → sensitive action = DENY
Anonymous → private student data = DENY
```

Frontend hiding bukan security boundary.

---

# 7. Organization / Partner Model

## 7.1 External Partners

**Status: LOCKED at concept level**

Candidate external partner categories:

- universitas;
- politeknik;
- lembaga pendidikan lanjutan;
- perusahaan;
- recruiter;
- scholarship provider;
- training provider;
- certification provider;
- business incubator;
- entrepreneurship mentor;
- supplier/franchise/business ecosystem;
- event/opportunity provider;
- merchant relevan lainnya.

---

## 7.2 Curated Partner Ecosystem

**Status: PROVISIONAL**

Arah yang pernah dibahas:

```text
Partner Registration
↓
Verification by ELLIGBLE
↓
Approved Partner
↓
Opportunity / Service Publication
↓
Matching / Discovery
↓
Student Opt-in / Referral / Application
```

Partner tidak seharusnya bebas melakukan spam/promosi langsung ke siswa.

Detail verification, ranking, monetization, consent, dan moderation masih OPEN.

---

# 8. Business Model Recovery

## 8.1 School SaaS

**Status: PROVISIONAL**

Potential revenue:

- school subscription;
- package-based feature access;
- trial;
- upgrade/downgrade;
- billing per tenant / package / usage.

Pricing belum dikunci.

---

## 8.2 Partner / Merchant Revenue

**Status: PROVISIONAL**

Potential models:

- partner subscription;
- verified partner package;
- featured opportunity;
- recruitment package;
- admission campaign;
- qualified lead;
- referral;
- event sponsorship;
- successful conversion;
- premium partner analytics.

Rule yang perlu dipertahankan:

> Relevance and student trust must take priority over pay-to-win placement.

---

# 9. Product / Design Direction

## 9.1 LinkedIn Reference

**Status: LOCKED**

LinkedIn digunakan sebagai:

- product reference;
- information architecture inspiration;
- profile/network inspiration;
- feed/navigation inspiration;
- professional visual-language reference;
- opportunity ecosystem reference.

ELLIGBLE tidak boleh menjadi clone LinkedIn.

---

## 9.2 Visual Direction

**Status: PROVISIONAL, strong direction**

Recovered direction:

- professional;
- clean;
- modern;
- trustworthy;
- academic;
- card-based;
- generous whitespace;
- professional blue family;
- light/neutral backgrounds;
- clear hierarchy;
- centralized design tokens;
- responsive/adaptive layouts.

Final color tokens menunggu brand/design discovery.

---

## 9.3 Language

**Status: LOCKED**

User-facing application:

```text
Bahasa Indonesia
```

Technical implementation:

```text
English technical terminology allowed/preferred
```

Examples:

```text
UI: Kelola Peserta Ujian
Code: ExamParticipant
DB: exam_participants
API: /api/exams/:examId/participants
```

---

# 10. Device Strategy

## 10.1 Mobile-First

**Status: LOCKED**

Principle:

> MOBILE-FIRST, MULTI-DEVICE — NOT MOBILE-ONLY

Primary student device assumption:

```text
1. Android smartphone
2. iPhone / iOS
3. Tablet
4. PC / Laptop
```

Desktop remains first-class for:

- teacher;
- proctor;
- school admin;
- principal;
- counselor;
- platform owner;
- reporting;
- question authoring;
- exam builder;
- bulk operations;
- monitoring.

---

## 10.2 Android / Play Store

**Status: LOCKED direction, FUTURE implementation stage**

ELLIGBLE harus dapat dikembangkan menjadi aplikasi Android dan dipublikasikan ke Play Store.

Architecture tidak boleh web-only.

iOS juga harus dipertimbangkan, tetapi release strategy belum dikunci.

---

# 11. Backend Architecture

## 11.1 Initial Backend

**Status: LOCKED**

Initial backend provider:

```text
InsForge
```

---

## 11.2 Provider Strategy

**Status: LOCKED**

Principle:

> INSFORGE-FIRST, PROVIDER-AGNOSTIC

ELLIGBLE domain/business logic tidak boleh menjadi InsForge-specific architecture.

Target boundary:

```text
UI
↓
Application / Use Cases
↓
Domain
↓
Ports / Interfaces
↓
Infrastructure Adapter
↓
InsForge
```

---

## 11.3 Candidate Provider Ports

**Status: PROVISIONAL**

Potential abstractions:

```text
AuthPort
Repository Layer
StoragePort
RealtimePort
FunctionExecutionPort
JobQueuePort
NotificationPort
EmailPort
SearchPort
AnalyticsPort
PaymentPort
AIProviderPort
```

Abstraction hanya dibuat bila memberikan boundary yang nyata; hindari over-engineering.

---

# 12. Coding / Agent Execution Strategy

## 12.1 Primary Coding Agent

**Status: LOCKED**

Antigravity menjadi primary coding execution agent.

ChatGPT digunakan untuk:

- recovery;
- discovery;
- architecture;
- specification;
- review;
- audit;
- troubleshooting;
- decision support.

ChatGPT Work dapat digunakan untuk large-scale audit/consolidation.

---

## 12.2 Granular Build Strategy

**Status: LOCKED**

Hierarchy:

```text
Domain
↓
Module
↓
Submodule
↓
Feature
↓
Build Unit
↓
Verification Gate
```

Rule:

> ONE BUILD UNIT PER AGENT EXECUTION

---

## 12.3 Terminal Verification

**Status: LOCKED**

Agent tidak boleh menyatakan task selesai hanya karena code telah ditulis.

Potential verification:

```text
git status
git diff --stat
git diff
typecheck
lint
unit test
integration test
build
E2E
database verification
tenant isolation verification
security verification
device/responsive verification
```

Exact command mengikuti stack final.

---

# 13. Core Role Inventory

Role list berikut adalah recovered inventory dan belum seluruhnya dianggap final RBAC.

| Role | Status |
|---|---|
| Platform Owner | LOCKED |
| Platform Admin / Internal ELLIGBLE Operations | PROVISIONAL |
| School Admin / Administrator Sekolah | LOCKED concept |
| Principal / Kepala Sekolah | LOCKED concept |
| Teacher / Guru | LOCKED concept |
| Proctor / Pengawas | LOCKED concept |
| Counselor / Guru BK | LOCKED concept |
| Student / Siswa | LOCKED |
| Parent / Guardian | LOCKED concept |
| Alumni | LOCKED concept |
| Partner | LOCKED concept |
| Partner Admin / Staff | OPEN |
| Support Agent | PROVISIONAL |
| Moderator / Trust & Safety | PROVISIONAL |

Detailed permission matrix remains OPEN.

---


# 13A. RECOVERY-R2.5 Review Outcome — User Model, Roles, Assignments & Identity Continuity

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.5  
**Owner Approval:** APPROVED

This review replaces a role-heavy model with a simpler and more scalable access model.

The core principle is:

> **Do not create a new permanent role for every job title, temporary duty, or organizational position.**

ELLIGBLE should separate:

```text
PERSON / USER IDENTITY
↓
ORGANIZATION / TENANT MEMBERSHIP
↓
BASE ACCESS TYPE
↓
ASSIGNMENTS / POSITIONS
↓
PERMISSION BUNDLES / CAPABILITIES
↓
POLICY / CONTEXT CHECK
```

This enables one human to hold multiple responsibilities without creating uncontrolled role combinations.

---

## R2.5-01 — Platform Owner

**Decision:** LOCKED

Platform Owner remains the highest platform-level authority.

However:

- Platform Owner is not intended for routine daily operations;
- routine work is delegated to internal platform staff;
- privileged access must remain auditable;
- high-risk actions may require stronger approval/control;
- Platform Owner authority does not bypass data-integrity and fraud-control principles.

Conceptual scope:

```text
PLATFORM OWNER
↓
Platform Governance
Strategic Configuration
Highest-Level Approval
Emergency / Break-Glass Authority
Oversight
```

Daily operations should use delegated platform staff capabilities.

---

## R2.5-02 — Internal ELLIGBLE Team

**Decision:** LOCKED

Internal platform operations may include functional assignments such as:

```text
Platform Operations
Support
Trust & Safety / Fraud
Partner Verification
Billing Operations
Security Operations
```

These should not necessarily become six unrelated top-level identity roles.

Preferred model:

```text
BASE ACCESS TYPE:
PLATFORM_STAFF

+

CAPABILITY BUNDLES / ASSIGNMENTS:
SUPPORT
TRUST_SAFETY
PARTNER_VERIFICATION
BILLING_OPERATIONS
SECURITY_OPERATIONS
TENANT_OPERATIONS
```

A staff member may hold more than one authorized capability bundle.

High-risk capabilities remain separately controlled.

---

## R2.5-03 — School Leadership & Administration Without Role Explosion

**Decision:** LOCKED — CHANGED

The previous approach of creating many permanent roles such as:

```text
Principal
Vice Principal
Vice Principal Curriculum
Vice Principal Student Affairs
Vice Principal Facilities
Vice Principal Public Relations
Operator
Teacher
Homeroom Teacher
Proctor
Counselor
```

as completely separate user roles is superseded.

Preferred model:

```text
BASE ACCESS TYPE:
SCHOOL_STAFF
```

Then attach assignments/positions such as:

```text
TEACHER
PRINCIPAL
VICE_PRINCIPAL
CURRICULUM_COORDINATOR
STUDENT_AFFAIRS_COORDINATOR
FACILITIES_COORDINATOR
PUBLIC_RELATIONS_COORDINATOR
SCHOOL_OPERATOR
HOMEROOM_TEACHER
COUNSELOR
PROCTOR
```

These assignments may be:

```text
PERMANENT
TEMPORARY
ACADEMIC-YEAR-BOUND
SEMESTER-BOUND
EXAM-BOUND
CLASS-BOUND
SUBJECT-BOUND
```

Example:

```text
User: Guru A
Base Access: SCHOOL_STAFF

Assignments:
├── TEACHER
├── VICE_PRINCIPAL
└── PROCTOR for Exam Session X
```

No separate account is required.

### Why This Is Preferred

This avoids:

- role explosion;
- duplicate accounts;
- confusing permission matrices;
- manual account switching;
- unnecessary special-case code.

It also reflects real school operations where one person may hold multiple responsibilities.

---

## R2.5-04 — Academic Staff Uses the Same Assignment Model

**Decision:** LOCKED — CLARIFIED

Teacher, Homeroom Teacher, Counselor, and Proctor should not automatically be treated as completely separate permanent identity roles.

Preferred structure:

```text
SCHOOL_STAFF
├── TEACHER
├── HOMEROOM_TEACHER
├── COUNSELOR
└── PROCTOR
```

Assignments can carry context.

Examples:

```text
TEACHER
subject = Economics
classes = XA, XB

HOMEROOM_TEACHER
class = XC
academic_year = 2026/2027

PROCTOR
exam_session = UAS-2026-ROOM-03
valid_from = ...
valid_until = ...
```

Permissions should be derived from:

```text
base access
+
assignment
+
scope
+
time
+
resource ownership
+
policy
```

not merely from a single role name.

---

## R2.5-05 — Student as Primary Mobile User, With the Same Identity Architecture

**Decision:** LOCKED — EXPANDED

Student remains the primary mobile-first user population.

However, the same identity architecture should apply:

```text
PERSON / USER
↓
SCHOOL TENANT MEMBERSHIP
↓
STUDENT ACCESS TYPE
↓
ACADEMIC ENROLLMENT
↓
CLASS / PROGRAM / COHORT CONTEXT
```

The student account should not be rebuilt every academic year.

Student identity should survive:

```text
class promotion
program changes
school transfer
graduation
alumni transition
```

The distinction is between:

> **who the person is**

and:

> **which institution/status/context the person currently belongs to.**

---

## R2.5-06 — Parent / Guardian Has an Independent Account

**Decision:** LOCKED

Parent/Guardian does not log in using the student's account.

Preferred relationship:

```text
GUARDIAN USER
↓
GUARDIAN-STUDENT RELATIONSHIP
├── Student A
├── Student B
└── potentially students in different ELLIGBLE tenants
```

A guardian may be linked to multiple children.

A child may have multiple authorized guardians.

Relationship types may include:

```text
Father
Mother
Legal Guardian
Other Authorized Guardian
```

Exact legal/consent rules remain subject to Parent discovery.

---

## R2.5-07 — Student Transfer Between ELLIGBLE Schools

**Decision:** LOCKED — EXPANDED

A student who transfers from one ELLIGBLE school to another should:

> **keep the same ELLIGBLE person/account identity whenever identity matching is valid.**

Do not create a new independent identity merely because the tenant changes.

Conceptual model:

```text
GLOBAL PERSON / USER
        │
        ├── Membership: School A
        │       status = TRANSFERRED_OUT
        │       effective dates = historical
        │
        └── Membership: School B
                status = ACTIVE
                effective dates = current
```

### Important Data Ownership Principle

A transfer must NOT mean that all old tenant records are physically reassigned to the new tenant.

Preferred rule:

```text
School A records
remain owned by School A

School B records
are created/owned by School B

Portable verified student history
is represented through approved Passport / transfer records
```

This protects:

- audit history;
- tenant ownership;
- academic truth;
- legal/accountability boundaries;
- historical reporting.

### Transfer Flow — Candidate

```text
Student transfer initiated
↓
Identity match / verification
↓
Transfer-out process at School A
↓
Portable transfer package prepared
↓
Student membership at School A becomes historical
↓
School B accepts / verifies student
↓
New School B membership becomes active
↓
Approved portable records become visible/importable
↓
Passport continuity preserved
```

### Duplicate Identity Prevention

The system must later design a controlled identity-matching strategy using appropriate signals such as:

```text
ELLIGBLE user/person ID
official student identifier where lawful/available
verified email/phone where appropriate
date of birth / identity verification where permitted
school transfer documentation
guardian confirmation
manual review for ambiguous matches
```

Sensitive identifiers must be handled under privacy/security rules.

### Same-Named Students

Names must never be used as canonical identity keys.

---

## R2.5-08 — Alumni Is a Lifecycle State, Not a New Account

**Decision:** LOCKED — EXPANDED

Graduation should transition the same person/account:

```text
STUDENT
↓
GRADUATED
↓
ALUMNI
```

The previous school membership becomes historical/alumni-linked.

Passport continuity remains.

Future alumni assignments may include:

```text
MENTOR
SPEAKER
RECRUITER
PARTNER_STAFF
COMMUNITY_CONTRIBUTOR
```

without creating duplicate identities.

---

## R2.5-09 — Partner Organization Uses Staff Membership + Assignments

**Decision:** LOCKED — EXPANDED

Partner organizations have their own organization context.

Preferred model:

```text
PARTNER ORGANIZATION
↓
PARTNER STAFF MEMBERSHIP
↓
ASSIGNMENT / FUNCTION
```

Candidate assignments:

```text
PARTNER_ADMIN
RECRUITER
HR
SCHOLARSHIP_OFFICER
ADMISSION_OFFICER
TRAINING_OFFICER
MENTOR
PROGRAM_MANAGER
```

One person may have more than one assignment.

Example:

```text
User B
Partner Organization X
Assignments:
├── RECRUITER
└── INTERNSHIP_PROGRAM_MANAGER
```

Partner permissions remain restricted to:

- their organization;
- their opportunities;
- approved applicants;
- verified connections;
- explicitly consented data.

---

## R2.5-10 — External Assessor / Guest Should Not Become a Broad Permanent Role

**Decision:** LOCKED — RECOMMENDED MODEL

A generic long-lived `GUEST` role is not recommended as the default.

Reason:

- vague scope;
- high risk of permission creep;
- difficult auditing;
- unclear lifecycle;
- temporary actors often need narrowly defined access.

Preferred model:

> **Temporary Scoped Assignment / External Collaborator Grant**

Candidate use cases:

```text
External Assessor
External Examiner
Guest Speaker
Temporary Mentor
External Reviewer
Competition Judge
Certification Assessor
Industry Expert
```

Target pattern:

```text
Verified/Invited Person
↓
Temporary Assignment
↓
Specific Tenant / Module / Resource Scope
↓
Explicit Permissions
↓
Start Time
↓
Expiry Time
↓
Audit
```

Example:

```text
Assignment:
EXTERNAL_ASSESSOR

Scope:
Assessment ABC

Tenant:
School X

Permissions:
READ_SUBMISSIONS
WRITE_ASSESSMENT_REVIEW

Valid:
2026-09-01 to 2026-09-03
```

After expiry:

```text
ACCESS = REVOKED AUTOMATICALLY
```

This is safer and more flexible than a global permanent Guest role.

---

## R2.5-11 — Multi-Role / Multi-Assignment Is a Core Identity Requirement

**Decision:** LOCKED — EXPANDED

One human may hold multiple valid contexts at the same time.

Examples:

```text
Teacher
+ Homeroom Teacher
+ Proctor

School Staff
+ Vice Principal
+ Teacher

Alumni
+ Mentor

Alumni
+ Partner Staff
+ Recruiter

Parent
+ School Staff
```

ELLIGBLE should avoid duplicate accounts for these situations.

### Preferred Authorization Model

Conceptually:

```text
USER
↓
MEMBERSHIPS
├── Platform Membership
├── School Membership
├── Partner Membership
└── Alumni Context
↓
ASSIGNMENTS
↓
CAPABILITIES
↓
POLICY CHECK
```

Authorization should consider:

```text
Who is the user?
Which organization/tenant are they acting in?
Which assignment is active?
What resource are they accessing?
What is their scope?
Is the assignment still valid?
Does the user own/manage this resource?
Is consent required?
Is this action privileged?
```

---

## R2.5-12 — Context Switching Without Account Duplication

**Decision:** LOCKED — EXPANDED

If one person belongs to multiple contexts, the application should support safe context switching.

Example:

```text
Yusuf
├── School A — SCHOOL_STAFF / TEACHER
├── Partner X — PARTNER_STAFF / MENTOR
└── Alumni Context — ALUMNI
```

UI may provide an explicit current context indicator.

Example:

```text
Sedang menggunakan ELLIGBLE sebagai:
SMA X — Guru
```

Switching context must not silently merge permissions.

Every request should resolve the active context explicitly.

This is especially important for:

- tenant isolation;
- audit logs;
- partner-school boundaries;
- Platform Staff access;
- multi-organization users.

---

## R2.5-13 — Base Access Types Should Remain Small

**Decision:** LOCKED — ARCHITECTURE DIRECTION

Rather than dozens of roles, the current recommended high-level access types are approximately:

```text
PLATFORM_OWNER
PLATFORM_STAFF
SCHOOL_STAFF
STUDENT
GUARDIAN
ALUMNI
PARTNER_STAFF
```

This is not yet the final database enum.

The exact implementation may use policy tables rather than static enums.

The important principle is:

> **Keep base access types small; express real-world responsibilities through assignments, scopes, and capabilities.**

---

## R2.5-14 — Permission Architecture Direction

**Decision:** LOCKED — DIRECTION

Pure RBAC alone may become insufficient for ELLIGBLE.

Recommended direction:

```text
RBAC
+
SCOPED ASSIGNMENTS
+
ATTRIBUTE / CONTEXT CHECKS
+
RESOURCE OWNERSHIP
+
TENANT BOUNDARY
+
TIME BOUNDARY
```

Example:

A user with `PROCTOR` assignment may only monitor:

```text
the assigned exam
during the assigned time
within the assigned tenant
```

not every assessment in the platform.

This provides a more precise authorization model without creating hundreds of permanent roles.

---

## R2.5 Consolidated Result

```text
R2.5-01 Platform Owner                              → LOCKED
R2.5-02 Internal ELLIGBLE Team                     → LOCKED
R2.5-03 School Leadership/Admin                    → LOCKED — CHANGED
R2.5-04 Academic Staff                             → LOCKED — CLARIFIED
R2.5-05 Student                                    → LOCKED — EXPANDED
R2.5-06 Parent / Guardian                          → LOCKED
R2.5-07 Student Transfer                           → LOCKED — EXPANDED
R2.5-08 Alumni                                     → LOCKED — EXPANDED
R2.5-09 Partner Staff                              → LOCKED — EXPANDED
R2.5-10 External/Guest Access                      → LOCKED — TEMPORARY SCOPED MODEL
R2.5-11 Multi-Role                                 → LOCKED — EXPANDED
R2.5-12 Context Switching                          → LOCKED — EXPANDED
R2.5-13 Small Base Access Types                    → LOCKED
R2.5-14 Authorization Model Direction              → LOCKED
```

These decisions supersede conflicting role-heavy recovery assumptions.

---

# 14. Core / Identity Recovery

Candidate capabilities:

```text
Account creation
Login
Logout
Password recovery
Session management
Device/session management
User profile
Multi-role user
Role assignment
Temporary role
Role expiry
Delegation
Tenant membership
Parent-student relationship
Audit log
Consent
Support access
```

**Status:** PROVISIONAL inventory.

Questions still OPEN:

- canonical login identifiers;
- MFA requirements;
- student account provisioning;
- school invitation model;
- alumni account transition;
- impersonation/support access policy;
- platform-owner visibility into tenant data.

---


# 14A. RECOVERY-R2.6 Review Outcome — Identity & Account Lifecycle

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.6  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete identity/account lifecycle direction.

---

## R2.6-01 — One Human, One Global ELLIGBLE Identity

**Decision:** LOCKED

ELLIGBLE should maintain one global person/user identity whenever identity continuity can be verified.

Conceptual model:

```text
GLOBAL ELLIGBLE PERSON
↓
USER ACCOUNT
↓
MEMBERSHIPS / CONTEXTS
├── School A — Student
├── School A — Alumni
├── School B — School Staff
├── Partner X — Partner Staff
└── Guardian Relationship
```

A person's institutional context may change without creating a new canonical identity.

The global identity must use an immutable internal identifier.

---

## R2.6-02 — Account Provisioning Must Avoid Duplicate Identity Creation

**Decision:** LOCKED

School provisioning/import must not blindly create a new global identity for every imported record.

Preferred conceptual flow:

```text
IMPORT / PROVISION
↓
VALIDATE INPUT
↓
IDENTITY MATCHING
↓
Existing verified identity?
├── YES → create/update membership
├── UNCERTAIN → review / potential duplicate
└── NO → create new identity
```

Identity matching must use approved evidence, not name matching alone.

Bulk import must be:

```text
idempotent
auditable
resumable where necessary
duplicate-aware
tenant-scoped
```

---

## R2.6-03 — Flexible Login, Not Email-Only

**Decision:** LOCKED — DIRECTION

Student login must not depend exclusively on email ownership.

Preferred direction:

```text
Primary account identifier:
ELLIGBLE ID / Username

Authentication:
Password / approved credential

Optional recovery/contact channels:
Verified Email
Verified Phone
```

Final authentication UX may vary by user type.

Privileged staff may use stronger authentication requirements than students.

The final login identifier strategy remains subject to Auth discovery, but:

> **Email-only identity is rejected as the universal assumption.**

---

## R2.6-04 — MFA / Step-Up Authentication for Privileged Actions

**Decision:** LOCKED

MFA and/or step-up authentication should be required for privileged users/actions according to risk.

Candidate privileged contexts:

```text
Platform Owner
Security Operations
Trust & Safety
High-Privilege Platform Staff
School Admin sensitive actions
Partner Admin sensitive actions
High-risk data export
Ownership transfer
Permission escalation
Verified Passport correction
Sensitive evidence access
```

Students should not be forced through unnecessary MFA for routine low-risk usage unless policy/risk requires it.

---

## R2.6-05 — Multi-Path Account Recovery

**Decision:** LOCKED

Account recovery must not depend on a single fragile channel.

Candidate recovery routes:

```text
Verified self-service channel
School-assisted recovery
Guardian-assisted verification where appropriate
Platform support escalation
Security/manual review for high-risk cases
```

Sensitive recovery must be:

```text
Audited
Rate-limited
Abuse-resistant
Risk-aware
Revocable
```

Recovery must never require administrators to know or reveal user passwords.

---

## R2.6-06 — Device & Session Management

**Decision:** LOCKED

ELLIGBLE should maintain session/device visibility where technically and legally appropriate.

Candidate user controls:

```text
Perangkat / Sesi Saya
Last Active
App / Browser
Approximate Device Information
Logout One Session
Logout All Sessions
Suspicious Login Alert
Session Revocation
```

General ELLIGBLE use may allow multiple devices.

Assessment may impose stricter session/device rules.

Therefore:

```text
GENERAL SESSION POLICY
≠
ASSESSMENT SESSION POLICY
```

Assessment-specific device restrictions must remain isolated in the Secure Assessment domain.

---

## R2.6-07 — Mutable Attributes Must Never Be Canonical Identity Keys

**Decision:** LOCKED

The following must NOT become canonical identity keys:

```text
name
school name
class
email
phone number
address
display username where changeable
```

because they may:

- change;
- be duplicated;
- be corrected;
- be missing.

Canonical identity must use an immutable ELLIGBLE internal identifier.

---

## R2.6-08 — Duplicate Identity Handling Uses Review, Not Aggressive Auto-Merge

**Decision:** LOCKED

Potential duplicate identities must enter a controlled review process.

Preferred flow:

```text
POTENTIAL DUPLICATE DETECTED
↓
Matching evidence collected
↓
Confidence evaluated
↓
Manual / controlled review if required
↓
MERGE only when sufficiently proven
↓
Audit merge
↓
Preserve source lineage
```

Key safety principle:

> **A false merge between two different people is more dangerous than temporarily keeping a duplicate identity.**

### Merge Requirements — Candidate

A future merge workflow should consider:

```text
Source memberships
Student records
Guardian relationships
Passport records
Login credentials
Assessment history
Audit history
Partner relationships
Alumni history
Consent records
```

Merge should not destroy provenance.

Where possible:

```text
Canonical Person
↓
Merged Identity References
↓
Historical IDs retained for audit
```

---

## R2.6-09 — Identity Lifecycle Is Independent From Institutional Lifecycle

**Decision:** LOCKED — EXPANDED

A user may experience:

```text
Student
↓
Transfer
↓
Student at another school
↓
Graduate
↓
Alumni
↓
Partner Staff / Mentor / Recruiter / Guardian
```

without losing their core ELLIGBLE identity.

Institutional membership is temporal.

Person identity is long-lived.

---

## R2.6-10 — Identity Events Must Be Auditable

**Decision:** LOCKED — EXPANDED

High-value identity events should produce auditable records, for example:

```text
Account created
Identity matched
Membership created
Membership ended
Student transferred
Graduation transition
Guardian linked/unlinked
Privileged assignment granted/revoked
Account recovery
MFA changed
Sensitive session revoked
Identity merge
Account suspension
```

Audit requirements will be finalized during Security/Identity discovery.

---

## R2.6 Consolidated Result

```text
R2.6-01 One Human / One Global Identity          → LOCKED
R2.6-02 Duplicate-Aware Provisioning             → LOCKED
R2.6-03 Flexible Login                           → LOCKED — DIRECTION
R2.6-04 MFA / Step-Up                            → LOCKED
R2.6-05 Account Recovery                         → LOCKED
R2.6-06 Device & Session Management              → LOCKED
R2.6-07 Immutable Canonical Identity             → LOCKED
R2.6-08 Duplicate Review / Safe Merge            → LOCKED
R2.6-09 Long-Lived Identity Lifecycle            → LOCKED — EXPANDED
R2.6-10 Identity Audit Events                    → LOCKED — EXPANDED
```

These decisions supersede conflicting identity assumptions.

---

# 15. Academic Structure Recovery

Candidate concepts:

```text
School Profile
Academic Year
Semester
Academic Calendar
Grade
Cohort
Class / Rombel
Major / Concentration
Curriculum
Subject
Subject Group
Teacher
Teaching Assignment
Homeroom Teacher
Schedule
Attendance
Student Enrollment
Promotion
Class Transfer
Mutation In/Out
Inactive Status
Graduation
Alumni Transition
Parent Relationship
Import / Export
Archive
Duplicate Prevention
```

**Status:** PROVISIONAL inventory.

Rule:

> Academic structure must be configurable and not hardcoded to SMA N 1 Mlati.

---


# 15A. RECOVERY-R2.7 Review Outcome — Academic Structure & Lifecycle

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.7  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete academic-structure direction.

---

## R2.7-01 — Academic Structure Must Be Configurable

**Decision:** LOCKED

ELLIGBLE must support senior-secondary institutions with different academic structures, including:

```text
SMA
SMK
MA
MAK
dan jenjang sederajat
```

The platform must not hardcode assumptions that only fit one pilot school.

Configurable academic structure should support differences in:

```text
Curriculum
Grade Levels
Programs
Majors / Concentrations
Vocational Competencies
Subject Structure
Class / Rombel Structure
Academic Calendar
Enrollment Lifecycle
```

---

## R2.7-02 — Academic Year, Period & Calendar

**Decision:** LOCKED

Each tenant should maintain:

```text
Academic Year
↓
Academic Period / Semester
↓
Academic Calendar
```

Semester is the default Indonesian model, but the data model should not be so rigid that other valid period structures become impossible.

Academic periods must be date-bounded and historically preserved.

Candidate examples:

```text
2026/2027
├── Semester 1
└── Semester 2
```

---

## R2.7-03 — Grade, Program, Major & Concentration Are Configurable

**Decision:** LOCKED

The system must not hardcode:

```text
X
XI
XII
```

as the only possible structure.

Candidate concepts include:

```text
Grade Level
Program
Major
Concentration
Vocational Skill Program
Competency Area
Class / Rombel
```

SMK-specific structures must be representable without forcing the SMA data model.

---

## R2.7-04 — Class / Rombel Is Historical Enrollment Context

**Decision:** LOCKED

A student's class must not be stored only as a mutable field on the user account.

Preferred conceptual model:

```text
STUDENT
↓
ACADEMIC ENROLLMENT HISTORY
├── 2026/2027 → XA
├── 2027/2028 → XI-A
└── 2028/2029 → XII-A
```

Changing class must preserve historical membership.

This is required for:

- historical report accuracy;
- assessment provenance;
- attendance history;
- Passport context;
- teacher assignment history;
- alumni records.

---

## R2.7-05 — Curriculum & Subject Structure Must Be Versioned

**Decision:** LOCKED

Curriculum and subject structures may change between academic years.

Therefore the platform should preserve historical relationships rather than silently replacing them.

Candidate structure:

```text
Curriculum Version
↓
Subject Structure
↓
Subject Group
↓
Academic Year / Period Applicability
```

Historical assessment, learning, and academic records must remain resolvable against the curriculum structure that applied at the time.

---

## R2.7-06 — Teaching Assignment Is Separate From Teacher Identity

**Decision:** LOCKED

Teacher identity does not by itself grant access to all classes and subjects.

Access should derive from scoped teaching assignments.

Example:

```text
Teacher A

Assignment:
Subject        = Economics
Classes        = XA, XB, XC
Academic Year  = 2026/2027
Semester       = 1
```

Teaching assignments may include:

```text
subject
class / rombel
academic year
academic period
effective date
end date
assignment status
```

Permissions should follow assignment scope.

---

## R2.7-07 — Schedule & Attendance Are Shared Academic Data

**Decision:** LOCKED

Schedule and attendance should be shared academic capabilities rather than duplicated independently across modules.

Potential consumers:

```text
Learn
Track
Parent
Care
Insight
School Operations
```

Access must occur through approved contracts/boundaries.

No module should maintain contradictory copies as its own source of truth.

---

## R2.7-08 — Student Lifecycle Must Be Explicit & Historical

**Decision:** LOCKED

Student academic lifecycle must be represented as explicit state/history.

Candidate lifecycle statuses:

```text
ACTIVE
PROMOTED
TRANSFERRED_CLASS
TRANSFERRED_OUT
TRANSFERRED_IN
LEAVE
INACTIVE
DROPPED_OUT
GRADUATED
ALUMNI
```

Final naming may be simplified later.

Important rule:

> **Status transition history must not be lost.**

Each meaningful transition should retain:

```text
previous status
new status
effective date
reason
actor/source
audit reference
```

---

## R2.7-09 — Official Student Identifiers Are References, Not Global Identity

**Decision:** LOCKED

Potential official/local identifiers:

```text
NIS
NISN
School Student Number
Other lawful official identifier
```

may be stored and validated.

However:

> **They do not replace the immutable global ELLIGBLE Person ID.**

Identifier records may have:

```text
type
value
issuer
scope
verification state
validity
```

This allows corrections and multiple institutional identifiers without changing the person's canonical identity.

---

## R2.7-10 — Controlled School Data Import Is a Core Onboarding Capability

**Decision:** LOCKED

Schools will frequently enter ELLIGBLE with existing data.

Controlled import should support:

```text
Upload
↓
Parse
↓
Validate
↓
Preview
↓
Duplicate Detection
↓
Error Report
↓
User Confirmation
↓
Import
↓
Audit
```

Candidate formats:

```text
Excel
CSV
Future integration/import connectors
```

Import must not silently accept malformed or ambiguous critical records.

Future requirements may include:

```text
dry-run
row-level errors
partial-success policy
idempotency
resume/retry
mapping templates
duplicate matching
rollback/reconciliation
```

---

## R2.7-11 — Important Academic Corrections Must Preserve History

**Decision:** LOCKED

Critical academic data must not use silent overwrite as the normal correction model.

Preferred pattern:

```text
Original Value
↓
Correction Request / Action
↓
New Value
↓
Reason
↓
Actor
↓
Timestamp
↓
Audit Trail
```

Applicable candidates include:

```text
Class assignment
Enrollment status
Official results
Attendance corrections
Verified achievements
Curriculum mapping
Teaching assignment
```

The exact correction workflow may vary by sensitivity.

---

## R2.7-12 — One Academic Core, Fault-Isolated Consumers

**Decision:** LOCKED

ELLIGBLE should maintain a shared Academic Core that provides canonical reference context such as:

```text
Tenant
Academic Year
Period
Student Enrollment
Class / Rombel
Subject
Curriculum
Teaching Assignment
Schedule
Attendance references
```

Modules such as:

```text
Learn
Assess
LPTPAT / Track
Care
Parent
Passport
Insight
```

may consume this shared context.

However:

> **Shared academic truth must not create dangerous runtime coupling.**

Specifically:

```text
Learn failure
≠
CBT live failure

LPTPAT processing failure
≠
CBT autosave failure

Insight delay
≠
Assessment submission failure
```

Assessment mission-critical paths must remain isolated from non-essential academic consumers.

---

## R2.7 Consolidated Result

```text
R2.7-01 Configurable Academic Structure        → LOCKED
R2.7-02 Academic Year / Period / Calendar      → LOCKED
R2.7-03 Grade / Program / Major                → LOCKED
R2.7-04 Historical Class / Rombel              → LOCKED
R2.7-05 Versioned Curriculum / Subject          → LOCKED
R2.7-06 Teaching Assignment                    → LOCKED
R2.7-07 Shared Schedule / Attendance           → LOCKED
R2.7-08 Student Lifecycle                      → LOCKED
R2.7-09 Official Student Identifiers           → LOCKED
R2.7-10 Controlled Import                      → LOCKED
R2.7-11 Academic Correction History            → LOCKED
R2.7-12 Shared Core + Fault Isolation          → LOCKED
```

These decisions supersede conflicting academic-structure assumptions.

---

# 16. Superapp Shell / Navigation Recovery

**Status: PROVISIONAL**

Candidate top-level experience:

```text
Home
Profile / Passport
Connect
Learn
Assess
Track
Care
Parent
Path
Partner
Alumni
Insight
Notifications
Messages
Search
Admin
```

Final navigation differs by role and device.

---


# 16A. RECOVERY-R2.8 Review Outcome — User Journey, Navigation & Superapp Experience

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.8  
**Owner Approval:** APPROVED — ALL ITEMS KEPT

## R2.8-01 — Role-Based Experience
**Decision:** LOCKED  
Home, navigation, shortcuts, and actions adapt to active context, assignments, permissions, and journey state.

## R2.8-02 — Mobile-First Student Shell
**Decision:** LOCKED  
Student UX prioritizes smartphone use with a deliberately simple primary navigation, roughly 4–5 primary destinations plus contextual/secondary actions.

## R2.8-03 — Desktop Productivity Workspace
**Decision:** LOCKED  
Desktop for teachers, proctors, school/platform staff, and partners may use sidebars, dense tables, bulk actions, split panels, multi-column layouts, and advanced filtering. Desktop must not merely enlarge a phone layout.

## R2.8-04 — Home as Operational Command Center
**Decision:** LOCKED  
Home must answer what matters now and what action should be taken next, not act as a social-media timeline.

## R2.8-05 — Critical Action Priority
**Decision:** LOCKED  
Critical actions such as imminent/active exams override lower-priority opportunity, content, or notification cards.

## R2.8-06 — One ELLIGBLE Experience Across Bounded Domains
**Decision:** LOCKED  
Learn, Assess, Track, Care, Parent, Passport, Path, Partner, Alumni, and other modules must share consistent design tokens, interactions, states, accessibility, and responsive behavior.

## R2.8-07 — Context-Aware Universal Search
**Decision:** LOCKED  
Unified search may exist but must respect active context, permission, tenant boundary, role/assignment, and resource authorization.

## R2.8-08 — Actionable Notifications
**Decision:** LOCKED  
Notifications should be classified by urgency/purpose such as CRITICAL, IMPORTANT, NORMAL, and INFO. Non-critical categories may be configurable; security/operational-critical alerts may be mandatory where justified.

## R2.8-09 — Progressive Disclosure
**Decision:** LOCKED  
ELLIGBLE may contain many capabilities, but complexity should be shown progressively based on role, grade, status, journey stage, need, assignment, and permission.

## R2.8-10 — Deep Link & Cross-Module Flow
**Decision:** LOCKED  
Users should move directly between related workflows while preserving context, authorization, tenant boundary, return path, and audit where relevant.

## R2.8-11 — Visible Active Context
**Decision:** LOCKED  
Multi-context users must always see which organization/role context is active. Context switching must be explicit and permissions must not silently merge.

## R2.8-12 — Accessibility & Real School Conditions
**Decision:** LOCKED  
ELLIGBLE must remain usable on mid/lower-end Android devices, small screens, touch input, variable networks, font scaling, battery constraints, and basic accessibility needs.

## R2.8-13 — No Social-Media Dark Patterns
**Decision:** LOCKED  
ELLIGBLE is not a social media platform. Avoid infinite scrolling, follower vanity, viral loops, engagement-for-engagement, and dark patterns. Engagement must support education, operations, bridging, opportunity, or verified outcomes.

## R2.8-14 — Role-Based Onboarding
**Decision:** LOCKED  
Onboarding adapts to user role/context and only introduces the workflows relevant to that user.

## R2.8-15 — Separate ELLIGBLE Design System Document
**Decision:** LOCKED — DOCUMENTATION REQUIREMENT  
A dedicated design-system document must later cover brand principles, color system, typography, spacing, grid, radius, elevation, iconography, components, navigation, mobile/desktop behavior, states, accessibility, motion, Assessment-specific UI, role-specific UI, design tokens, and do/don't examples.

Design must be distinctly ELLIGBLE, may use LinkedIn as inspiration rather than a clone, remain professional/educational, mobile-first for students, productive on desktop, and avoid social-media engagement patterns.

## R2.8 Consolidated Result

```text
R2.8-01 Role-Based Experience                  → LOCKED
R2.8-02 Mobile-First Student Shell             → LOCKED
R2.8-03 Desktop Productivity Experience        → LOCKED
R2.8-04 Home Operational Command Center        → LOCKED
R2.8-05 Critical Action Priority               → LOCKED
R2.8-06 Unified ELLIGBLE Experience            → LOCKED
R2.8-07 Context-Aware Search                   → LOCKED
R2.8-08 Actionable Notifications               → LOCKED
R2.8-09 Progressive Disclosure                 → LOCKED
R2.8-10 Deep Link / Cross-Module Flow          → LOCKED
R2.8-11 Visible Active Context                 → LOCKED
R2.8-12 Accessibility / Real Device Conditions → LOCKED
R2.8-13 No Social Dark Patterns                → LOCKED
R2.8-14 Role-Based Onboarding                  → LOCKED
R2.8-15 Separate Design System Document        → LOCKED
```

---

# 17. Home / Feed Recovery

Candidate capabilities:

- role-based home;
- school announcements;
- activity feed;
- upcoming assessment;
- learning reminders;
- progress summary;
- official posts;
- user posts;
- reactions;
- comments;
- save;
- share;
- mention;
- hashtags;
- polls;
- media attachments;
- moderation;
- reporting.

**Status:** PROVISIONAL / OPEN mix.

Important OPEN decisions:

- who may post;
- student posting policy;
- public vs tenant-only feed;
- ranking algorithm vs chronology;
- partner placement rules;
- moderation model;
- student safety.

---

# 18. Profile / Passport Recovery

## 18.1 Profile

Candidate:

- profile photo;
- cover;
- academic headline;
- bio;
- school;
- class;
- interests;
- goals;
- skills;
- achievements;
- activities.

**Status:** PROVISIONAL.

---

## 18.2 Passport

**Status: LOCKED concept**

Passport is intended to become the portable educational identity that can survive graduation.

Potential content:

- verified achievements;
- certificates;
- portfolio;
- competency;
- selected academic history;
- readiness indicators;
- learning/activity history;
- public/private sections.

OPEN:

- what academic records are portable;
- verification workflow;
- privacy model;
- consent to share with partners;
- data ownership after graduation.

---


# 18A. RECOVERY-R2.12 Review Outcome — Profile & ELLIGBLE Passport

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.12  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Profile/Passport direction.

---

## R2.12-01 — Profile and Passport Are Different Concepts

**Decision:** LOCKED

ELLIGBLE must distinguish:

```text
PROFILE
= user presentation / identity surface

PASSPORT
= verified long-term development record
```

Profile may include:

```text
Photo
Bio
Headline
Interests
Goals
Public-facing identity information
```

Passport is structured around provenance, verification, evidence, and long-term portability.

---

## R2.12-02 — Passport Is Automatically Created for Students

**Decision:** LOCKED

A Passport should be created as part of the student lifecycle, not as an optional manually-created feature.

Conceptual flow:

```text
Verified Student Identity
↓
Student Membership
↓
Passport Initialized
↓
Passport evolves over time
↓
Student → Graduate → Alumni
```

The same Passport continues across lifecycle transitions.

---

## R2.12-03 — Passport Covers More Than Academic Grades

**Decision:** LOCKED

Candidate Passport domains:

```text
Academic
Competency
Achievement
Portfolio
Certification
Experience
Project
Organization / Activity
Assessment
Training
Internship
Future Outcome
```

Passport should represent a broader picture of development than school grades alone.

---

## R2.12-04 — Every Important Record Has Provenance

**Decision:** LOCKED

Important Passport records should be able to identify:

```text
Source
Issuer
Verification Level
Issued At
Verified At
Verification Method
Evidence
Original Value
Correction History
Visibility
Consent Scope
```

A record without provenance must not be presented as equivalent to a verified record.

---

## R2.12-05 — School Grades Are Contextualized by Trust Signals

**Decision:** LOCKED

ELLIGBLE must address concerns about grade inflation/manipulation by showing provenance and verification context.

Partner-facing presentation should avoid displaying only:

```text
Score: 95
```

without context.

Possible supporting context:

```text
School-issued record
Issuer identity
Audit trail
Assessment source
ELLIGBLE standardized assessment where available
Integrity / provenance indicators
Correction history
```

The objective is not to claim that every score is perfectly objective.

The objective is:

> **Make the origin, verification strength, and supporting evidence understandable.**

---

## R2.12-06 — Verified Records Use Correction History, Not Silent Editing

**Decision:** LOCKED

Verified Passport records must not be silently overwritten.

Preferred pattern:

```text
Original Record
↓
Correction Request / Authorized Change
↓
Corrected Record
↓
Historical Version Retained
↓
Audit
```

Partner-facing views may indicate that a correction occurred without exposing unnecessary internal data.

---

## R2.12-07 — Self-Declared Records Are Allowed but Clearly Labeled

**Decision:** LOCKED

Students may add records such as:

```text
Personal project
Volunteer experience
Skill
Business activity
Portfolio
Organization experience
```

without an institutional source.

These records must initially be classified as:

```text
SELF-DECLARED
```

until an approved verification process changes their status.

---

## R2.12-08 — Passport Completeness Indicator

**Decision:** LOCKED

Passport may have a completeness indicator to help students identify missing useful information.

Example:

```text
Passport 74% complete
```

This must not be designed as an addictive gamification mechanic.

Completeness should be:

```text
informational
actionable
transparent
non-punitive
```

---

## R2.12-09 — Student Controls Data Sharing

**Decision:** LOCKED

Before Passport data is shared with an approved partner/opportunity, the student should understand which data is requested.

Example:

```text
Opportunity requests:
✓ Basic identity
✓ Selected competency
✓ Relevant certificates
✓ Academic summary
✗ Counseling record
✗ Parent private information
```

Consent and visibility rules must be purpose-specific.

---

## R2.12-10 — Sensitive Records Are Excluded From Standard Partner Passport Views

**Decision:** LOCKED

The following are excluded by default from normal Partner Passport access:

```text
Counseling notes
Private Care records
Parent private information
Raw anti-cheating evidence
Internal disciplinary notes
Security events
Other highly sensitive records
```

Any future exception requires dedicated legal/privacy/security discovery.

---

## R2.12-11 — Partner Receives an Application Snapshot, Not Unrestricted Live Database Access

**Decision:** LOCKED

Preferred application model:

```text
Passport
↓
Student Consent
↓
Application-Specific Snapshot
↓
Partner View
```

The snapshot preserves the relevant state at the time of application/selection.

Later Passport changes must not silently rewrite historical recruitment/scholarship decisions.

---

## R2.12-12 — Trust Summary Should Show Evidence, Not a Misleading Single Credibility Score

**Decision:** LOCKED

Default direction is to avoid a single opaque “trust score” as the primary representation.

A partner may instead see a summary such as:

```text
Verified Identity             ✓
School-Verified Records       18
ELLIGBLE-Verified Records     9
Externally Verified Records   4
Self-Declared Records         3
Evidence-Backed Records       21
```

This gives partners source transparency while reducing the risk of over-simplifying trust.

---

## R2.12-13 — Standardized ELLIGBLE Assessment Can Strengthen Passport

**Decision:** LOCKED — FUTURE CAPABILITY

ELLIGBLE may later provide standardized cross-school assessments such as:

```text
Economic Reasoning
Digital Literacy
Career Readiness
Other competency assessments
```

These do not replace official school records.

They provide an additional more-consistent reference signal that may strengthen Passport credibility.

Architecture should allow this capability in the future.

---

## R2.12-14 — Passport Is Portable Across ELLIGBLE Schools

**Decision:** LOCKED

When a student transfers:

```text
School A-owned academic data
→ remains owned by School A

School B-owned academic data
→ belongs to School B

Passport
→ preserves approved portable verified history
```

The Passport becomes a continuity layer without destroying institutional ownership/history.

---

## R2.12-15 — Passport Continues Into Alumni Lifecycle

**Decision:** LOCKED

After graduation, Passport continues to support:

```text
Higher education
Scholarship
Recruitment
Internship
Business opportunity
Certification
Mentorship
Alumni contribution
```

A student should not need to rebuild their development record from zero after graduation.

---

## R2.12-16 — Partner Talent Discovery Requires Explicit Opt-In

**Decision:** LOCKED

Two safer partner access models are approved conceptually:

### Application-Led Access

```text
Student applies
→ permitted Passport snapshot shared
```

### Opt-In Talent Discovery

```text
Student explicitly enables discoverability
↓
Partner sees limited searchable profile
↓
Further access/contact remains controlled
```

No partner may freely browse/download the entire student population.

---

## R2.12-17 — Passport Export & Verification

**Decision:** LOCKED

Future Passport sharing/export may support:

```text
Share Link
PDF / printable summary
QR verification
Application-specific share
```

Verified exports should provide authenticity checking.

Where appropriate, links may support:

```text
expiry
revocation
access scope
audit
```

---

## R2.12-18 — Passport Is Not a Conventional CV

**Decision:** LOCKED — PRODUCT PRINCIPLE

Core distinction:

> **A conventional CV mostly presents claims.  
> ELLIGBLE Passport should show what was recorded, where it came from, how it was verified, and what evidence supports it.**

This trust/provenance layer is a core differentiator of ELLIGBLE.

---

## R2.12 Consolidated Result

```text
R2.12-01 Profile ≠ Passport                         → LOCKED
R2.12-02 Automatic Passport                        → LOCKED
R2.12-03 Multi-Domain Development Record            → LOCKED
R2.12-04 Record Provenance                          → LOCKED
R2.12-05 Grade Trust Context                        → LOCKED
R2.12-06 Correction History                         → LOCKED
R2.12-07 Self-Declared Records                      → LOCKED
R2.12-08 Completeness Indicator                     → LOCKED
R2.12-09 Student-Controlled Sharing                 → LOCKED
R2.12-10 Sensitive Data Exclusion                   → LOCKED
R2.12-11 Application Snapshot                       → LOCKED
R2.12-12 Trust Summary                              → LOCKED
R2.12-13 Standardized ELLIGBLE Assessment           → LOCKED — FUTURE
R2.12-14 Cross-School Portability                   → LOCKED
R2.12-15 Alumni Continuity                          → LOCKED
R2.12-16 Opt-In Talent Discovery                    → LOCKED
R2.12-17 Export / Verification                      → LOCKED
R2.12-18 Passport Product Principle                 → LOCKED
```

These decisions supersede conflicting Passport/Profile assumptions.

---

# 19. Connect Recovery

Candidate connection graph:

```text
Student ↔ Student
Student ↔ Teacher
Student ↔ Alumni
Student ↔ Partner
School ↔ Partner
Alumni ↔ Alumni
```

Potential features:

- connect/follow;
- suggested connections;
- communities;
- groups;
- mentorship;
- network discovery.

**Status:** PROVISIONAL.

OPEN:

- follow vs two-way connection;
- minor safety restrictions;
- external messaging limits;
- teacher-student relationship model;
- partner contact rules.

---

# 20. Learn Recovery

Candidate modules:

```text
Digital Classroom
Learning Material
Assignment
Submission
Assessment-linked tasks
Feedback
Class Discussion
Attendance
Learning Progress
Remedial
Enrichment
Learning Archive
Parent Access
Learning Notifications
```

**Status:** PROVISIONAL inventory.

---


# 20A. RECOVERY-R2.13 Review Outcome — Learn / LMS

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.13  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Learn / LMS direction.

---

## R2.13-01 — Learn Is the Native LMS Domain of ELLIGBLE

**Decision:** LOCKED

Learn is the built-in learning-management workspace of ELLIGBLE.

Core candidate capabilities:

```text
Classroom
Learning Material
Assignment
Submission
Feedback
Discussion
Progress
Remedial
Enrichment
Learning Archive
```

Schools should be able to run core digital-learning workflows without requiring a separate external LMS.

---

## R2.13-02 — Learn Classrooms Derive From Academic Core

**Decision:** LOCKED

Teachers should not need to manually recreate official classes or re-enroll students when the academic relationship already exists.

Preferred flow:

```text
Academic Core
↓
Teaching Assignment
↓
Subject + Class / Rombel
↓
Learn Classroom
```

Teacher access must derive from the valid teaching assignment and context.

---

## R2.13-03 — Multi-Format Learning Content

**Decision:** LOCKED

Learning content may support:

```text
Rich Text
PDF
Image
Presentation / Document
Video Link
External Link
Downloadable File
Future Interactive Content
```

Binary files should use the approved storage layer rather than being embedded as arbitrary database blobs.

---

## R2.13-04 — Structured Learning Content

**Decision:** LOCKED

Learning materials should be organizable by a meaningful hierarchy such as:

```text
Course / Subject
↓
Topic / Chapter
↓
Material / Activity / Assignment
```

Example:

```text
Ekonomi XA
├── Bab 1
│   ├── Materi
│   ├── Video
│   ├── Latihan
│   └── Tugas
└── Bab 2
```

Future curriculum/learning-objective mapping may be added without redesigning the entire domain.

---

## R2.13-05 — Draft, Scheduled, Published, Archived Lifecycle

**Decision:** LOCKED

Content should support controlled publication states.

Candidate lifecycle:

```text
DRAFT
SCHEDULED
PUBLISHED
ARCHIVED
```

Students must not see draft content.

Important published content should preserve version/history when appropriate.

---

## R2.13-06 — Multiple Assignment Types

**Decision:** LOCKED

Candidate assignment types:

```text
Text Answer
File Upload
Image
Link
Portfolio Submission
Project
Future Group Assignment
```

Assignment configuration may include:

```text
Instructions
Deadline
Attachments
Grading Rule
Late Submission Policy
Revision Policy
```

---

## R2.13-07 — Submission Must Be Reliable on Weak Connections

**Decision:** LOCKED

ELLIGBLE must not claim a task was submitted before server acknowledgement.

Preferred conceptual state:

```text
DRAFT
↓
UPLOADING / SUBMITTING
↓
SERVER ACKNOWLEDGED
↓
SUBMITTED
```

Retry, reconnect, and recovery behavior must be defined for unreliable networks.

---

## R2.13-08 — Submission Version History

**Decision:** LOCKED

Where revision is allowed:

```text
Submission v1
↓
Teacher Feedback
↓
Revision
↓
Submission v2
```

Previous versions remain traceable according to policy.

---

## R2.13-09 — Rich Teacher Feedback

**Decision:** LOCKED

Teacher feedback may include:

```text
Score
Text Feedback
Rubric
Attachment
Future Audio Feedback where justified
```

Rubrics should be supported for projects, portfolio work, and competency-oriented assignments.

---

## R2.13-10 — Learn Integrates With Assess but Cannot Destabilize It

**Decision:** LOCKED

Learn may link to Assessment:

```text
Learn Topic
↓
Assessment
```

and may consume finalized Assessment outcomes.

However:

> **Learn failure must not cause active CBT failure.**

Mission-critical Assessment persistence and submission remain isolated.

Non-critical synchronization may use asynchronous patterns where appropriate.

---

## R2.13-11 — Remedial & Enrichment

**Decision:** LOCKED

Learn should support differentiated follow-up.

Examples:

```text
Student below criteria
→ Remedial material / task / assessment

Student ready for extension
→ Enrichment
```

The whole class does not always need to receive the same follow-up activity.

---

## R2.13-12 — Learning Progress Must Be Meaningful

**Decision:** LOCKED

Candidate progress states:

```text
Material Available
Material Accessed
Assignment Pending
Submission Completed
Feedback Available
Remedial Required
Activity Completed
```

The platform should avoid treating a simple click/open event as proof of meaningful learning.

---

## R2.13-13 — Parent Visibility Is Limited and Purposeful

**Decision:** LOCKED

Guardian/Parent may receive relevant visibility such as:

```text
Pending Assignment
Deadline
Progress
Selected Teacher Feedback
```

but does not automatically gain unrestricted access to:

```text
Internal class discussion
Teacher workspace
Other students
Private student workspaces
All detailed academic records
```

---

## R2.13-14 — Discussion Is for Learning, Not Social Networking

**Decision:** LOCKED

Learn discussion supports educational interaction only.

Candidate use cases:

```text
Question about material
Teacher response
Class learning discussion
Assignment-specific comment
```

No follower economy, virality mechanics, or engagement farming.

---

## R2.13-15 — Teacher Content Ownership & School Continuity

**Decision:** LOCKED — DIRECTION

Learning content should preserve ownership/provenance.

Candidate ownership categories:

```text
Private Teacher Draft
School-Owned Learning Content
Shared Subject Content
Reusable Template
```

When a teacher leaves, the school should not automatically lose content that was intentionally created as an official school resource.

The final IP/ownership rules require later business/legal discovery.

---

## R2.13-16 — Reuse Across Academic Periods

**Decision:** LOCKED

Teachers should be able to reuse:

```text
Course Structure
Material
Assignment Template
Rubric
```

across semesters/years where valid.

The system must not accidentally copy historical student-specific data such as:

```text
Old Submissions
Old Scores
Old Discussions
Old Student Membership
```

---

## R2.13-17 — Search & Organization

**Decision:** LOCKED

Learn should support efficient discovery of:

```text
Material
Assignment
File
Topic
Subject
```

using search and appropriate structure/tags where useful.

Users should not be forced to navigate only through long chronological lists.

---

## R2.13-18 — Learn Notifications

**Decision:** LOCKED

Candidate notification triggers:

```text
New Material
New Assignment
Deadline Approaching
Feedback Available
Revision Requested
Remedial Available
```

Notifications remain subject to the R2.8 priority/anti-spam rules.

---

## R2.13-19 — Teacher Analytics Are Aggregated and Contextual

**Decision:** LOCKED

Teacher dashboards may show:

```text
Who has not submitted
Submission status
Class progress
Remedial status
Learning engagement signals
```

No single engagement metric should be treated as definitive proof of student ability.

---

## R2.13-20 — Selective Learn → Passport Promotion

**Decision:** LOCKED

Routine tasks should not automatically flood Passport.

A meaningful artifact may follow a controlled flow such as:

```text
Project / Work
↓
Teacher marks Passport-eligible
↓
Verification workflow
↓
Student approval where required
↓
Passport record
```

This preserves Passport quality and signal value.

---

## R2.13-21 — AI May Assist Learn but Must Not Become a Hard Dependency

**Decision:** LOCKED — FUTURE CAPABILITY

Potential AI assistance:

```text
Draft learning material
Question suggestion
Feedback assistance
Summarization
Personalized recommendation
```

Rules:

- teacher remains responsible for published content;
- AI output requires appropriate review;
- Learn must continue functioning if the AI provider is unavailable;
- provider-specific AI integration should remain behind an approved abstraction.

---

## R2.13 Consolidated Result

```text
R2.13-01 Native Learn / LMS                       → LOCKED
R2.13-02 Academic-Core Classrooms                 → LOCKED
R2.13-03 Multi-Format Content                     → LOCKED
R2.13-04 Structured Content                       → LOCKED
R2.13-05 Publication Lifecycle                    → LOCKED
R2.13-06 Assignment Types                         → LOCKED
R2.13-07 Reliable Submission                      → LOCKED
R2.13-08 Submission Versioning                    → LOCKED
R2.13-09 Rich Feedback                            → LOCKED
R2.13-10 Learn ↔ Assess Integration               → LOCKED
R2.13-11 Remedial / Enrichment                    → LOCKED
R2.13-12 Meaningful Progress                      → LOCKED
R2.13-13 Limited Parent Visibility                → LOCKED
R2.13-14 Learning Discussion                      → LOCKED
R2.13-15 Content Ownership                        → LOCKED — DIRECTION
R2.13-16 Course Reuse                             → LOCKED
R2.13-17 Search / Organization                    → LOCKED
R2.13-18 Notifications                            → LOCKED
R2.13-19 Teacher Analytics                        → LOCKED
R2.13-20 Selective Passport Promotion             → LOCKED
R2.13-21 AI Assistance                            → LOCKED — FUTURE
```

These decisions supersede conflicting Learn/LMS assumptions.

---

# 21. Assess Recovery

## 21.1 Question Bank

Recovered requirements/ideas:

- question bank;
- text question;
- image attachment;
- optional image in question authoring;
- multiple question types;
- import/export;
- validation;
- grouping/tagging.

**Status:** LEGACY + PROVISIONAL.

OPEN:

- final question types;
- audio/video support;
- math/formula editor;
- versioning;
- shared/private question banks;
- question ownership;
- moderation/review workflow.

---

## 21.2 Exam Builder

Recovered:

- create exam;
- configuration;
- question selection;
- randomization;
- scheduling;
- publish;
- immutable published snapshot;
- public exam identifier.

**Status:** LEGACY to preserve concept; needs clean specification.

---

## 21.3 Participant Assignment

Recovered:

- participant list;
- add individual participant;
- bulk assignment;
- class-based assignment;
- eligibility validation;
- duplicate prevention;
- removal;
- permissions;
- audit;
- responsive cards/table.

**Status:** LEGACY implementation + PROVISIONAL clean rebuild.

Historical implementation reached participant management in the legacy project.

Do not directly copy without audit.

---

## 21.4 Exam Runtime

Candidate:

```text
Join exam
Eligibility check
Exam session
Timer
Question navigation
Answer input
Autosave
Connection status
Reconnect
Local recovery
Review
Submit
Submission confirmation
Session recovery
```

**Status:** LEGACY concepts + PROVISIONAL redesign.

---

## 21.5 Grading / Results

Candidate:

- automatic grading;
- manual grading;
- essay review;
- score;
- item analysis;
- remedial;
- objection/review;
- archive.

**Status:** PROVISIONAL.

---


# 21A. RECOVERY-R2.14 Review Outcome — Assess / CBT Core

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.14  
**Owner Approval:** APPROVED — SELECTIVE EXPANSIONS

The Platform Owner approved the Assess / CBT Core direction with explicit changes to Question Bank deletion, question lifecycle deletion, Exam Type, and schedule-conflict prevention.

---

## R2.14-01 — Assess Is the Most Mission-Critical Domain

**Decision:** LOCKED

Assessment remains the highest-priority mission-critical domain.

Priority order:

```text
1. No lost answers
2. Valid submission
3. Recoverable session
4. Data integrity
5. Exam security
6. Proctor monitoring
7. Analytics / reporting
```

Visual polish, non-critical analytics, and unrelated modules must never take priority over answer safety and submission integrity.

---

## R2.14-02 — Question Bank Is the Official Question Repository

**Decision:** LOCKED — EXPANDED

Question Bank is the canonical reusable question repository for teachers/schools.

Questions may be organized by:

```text
Subject
Curriculum
Grade
Topic
Competency
Difficulty
Question Type
Tag
Status
Ownership
```

### Archive and Delete

Questions must support:

```text
ACTIVE / USABLE
↓
ARCHIVED
↓
DELETE (when allowed)
```

A question may be deleted after it has first entered the Archive state, subject to safety checks.

### Deletion Safety Rules

Delete must not destroy historical exams.

If a question has ever been included in a published/finalized exam:

```text
Question Bank Record
may be archived/deleted from active repository
BUT
Published Exam Snapshot
must remain intact
```

Deletion therefore removes the reusable source record from the current Question Bank context without mutating historical immutable exam snapshots.

Candidate delete controls:

```text
Archive first
↓
Check references
↓
Warn user
↓
Require explicit confirmation
↓
Delete source record where policy permits
↓
Audit deletion
```

Soft-delete/tombstone vs physical deletion will be decided during database/privacy architecture.

---

## R2.14-03 — Question Ownership

**Decision:** LOCKED

Candidate ownership scopes:

```text
PRIVATE
SCHOOL
SHARED_SUBJECT
```

Cross-school sharing is not enabled by default.

---

## R2.14-04 — Question Types Are Extensible, Initial Release Prioritizes Multiple Choice

**Decision:** LOCKED — CLARIFIED

Primary initial question type:

```text
PILIHAN GANDA
```

Other question types are preserved as future/extensible capabilities rather than mandatory first-release scope.

Future candidates:

```text
Pilihan Ganda Kompleks
Benar / Salah
Isian Singkat
Essay
Matching / Menjodohkan
Numerical
Formula / Math
Audio-based
Video-based
Interactive
Case-based
```

The data model must not be designed so narrowly that future question types require a complete rewrite.

---

## R2.14-05 — Question Media

**Decision:** LOCKED

Initial question content may support:

```text
Text
Optional Image
Optional Attachment where appropriate
```

Future audio/video support remains extensible.

Binary media uses the approved Storage abstraction.

---

## R2.14-06 — Question Lifecycle, Archive, and Delete

**Decision:** LOCKED — EXPANDED

Candidate lifecycle:

```text
DRAFT
↓
REVIEWED
↓
ACTIVE
↓
ARCHIVED
↓
DELETED (when policy permits)
```

Important rule:

> A question must be archived before it can be deleted.

### Historical Safety

Deleting an archived Question Bank record must not change:

```text
Published Exam Snapshot
Historical Student Attempt
Historical Scoring
Appeal Evidence
Audit History
```

If deletion is restricted by retention/legal/audit requirements, the system may use a tombstone/soft-delete strategy while removing it from normal Question Bank views.

---

## R2.14-07 — Published Exam Uses an Immutable Snapshot

**Decision:** LOCKED

Publication creates an immutable exam snapshot.

```text
Question Bank
↓
Exam Draft
↓
Publish
↓
Immutable Exam Snapshot
```

Future edits/deletes of source questions must not mutate the published historical exam.

---

## R2.14-08 — Exam Builder Uses Exam Type Instead of Requiring a Free-Text Exam Name

**Decision:** LOCKED — EXPANDED / CHANGED

The Exam Builder should prioritize a structured field:

> **Jenis Ujian**

rather than requiring users to invent a separate `Nama Ujian` for every exam.

### Candidate Exam Types

Initial configurable taxonomy may include:

```text
Ulangan Harian
Asesmen / Kuis
UTS / PTS
UAS / PAS
Try Out
Remedial
Susulan
Simulasi
Latihan
Ujian Sekolah
Ujian Praktik (future where relevant)
Lainnya
```

Final labels must be configurable/localizable because terminology may vary by school, curriculum, or policy.

### Automatic Display Name

Instead of asking the teacher to manually type a redundant exam name, the system can generate a human-readable label from structured fields.

Example:

```text
Jenis Ujian : PTS
Mapel       : Ekonomi
Kelas       : XI-A
Semester    : 1
Tahun       : 2026/2027
```

Generated display:

```text
PTS Ekonomi XI-A — Semester 1 2026/2027
```

### When Custom Label Is Needed

A small optional field such as:

```text
Label Tambahan / Catatan
```

may be provided for exceptional cases.

Example:

```text
Try Out SNBT — Paket 2
```

But free-text naming must not replace structured `Jenis Ujian`.

### Exam Builder Core Fields

Candidate configuration:

```text
Jenis Ujian
Subject
Academic Context
Target Class / Participants
Instructions
Question Selection
Question Count
Duration
Exam Date
Start Time
End / Access Window
Passing Criteria
Randomization
Navigation Policy
Submission Policy
Security Policy
Room / Session Setup where applicable
```

---

## R2.14-09 — Exam Templates

**Decision:** LOCKED

Candidate reusable templates:

```text
Ulangan Harian
PTS / UTS
PAS / UAS
Try Out
Remedial
Practice
High-Security Exam
```

Templates reduce repeated configuration while remaining editable according to permission.

---

## R2.14-10 — Participant Assignment Uses Academic Core

**Decision:** LOCKED

Participants may be assigned by:

```text
Class / Rombel
Subject enrollment
Student group
Individual student
Bulk selection/import
```

Validation must prevent:

```text
Duplicate participant
Wrong tenant
Inactive student
Invalid academic enrollment
```

Legacy Participant Assignment is reference material and will be audited before reuse.

---

## R2.14-11 — Exam Room Is Different From Academic Class

**Decision:** LOCKED

```text
Academic Class
≠
Exam Room
```

Students from multiple classes may be distributed across exam rooms where policy requires it.

This distinction supports scheduling, seating/room allocation, and proctoring.

---

## R2.14-12 — Exam Scheduling Lifecycle + Proactive Conflict Detection

**Decision:** LOCKED — EXPANDED

Candidate lifecycle:

```text
DRAFT
SCHEDULED
READY
ACTIVE
PAUSED / INCIDENT
ENDED
FINALIZED
ARCHIVED
```

### Schedule Conflict Prevention

The scheduling UI must proactively help users avoid conflicts.

Historical ELLIGBLE/CBT direction already included:

```text
Cross-class / cross-subject exam calendar
Schedule conflict detection
Automatic overlap warning
```

This is now retained and expanded.

### Core Conflict Rule

Different classes may take different exams at the same time.

However:

> **The same student/class target must not be assigned to overlapping incompatible exam sessions.**

Example:

```text
XI-A — Ekonomi
08:00–09:30

XI-A — Matematika
09:00–10:30

→ CONFLICT
```

But:

```text
XI-A — Ekonomi
08:00–09:30

XI-B — Matematika
08:00–09:30

→ MAY BE ALLOWED
```

subject to room/proctor/resource policy.

### Date/Time Entry Assistance

When the teacher/operator selects an exam date/time, the UI should show relevant existing schedules.

Candidate UX:

```text
Tanggal: 20 September 2026
Waktu  : 08:00–09:30

Existing:
08:00–09:30 XI-A — Matematika     CONFLICT
10:00–11:30 XI-A — Bahasa Indonesia AVAILABLE
```

The user should receive an inline warning before save/publish, not only after the exam is fully configured.

### Conflict Dimensions — Candidate

Future scheduling validation should consider:

```text
Student overlap
Class / Rombel overlap
Exam Room overlap
Proctor overlap
Schedule window
Exam status
Tenant
Special participant group
```

Not every conflict has equal severity.

Candidate result:

```text
BLOCKING_CONFLICT
WARNING
INFORMATIONAL
```

### Calendar View

School staff should later be able to view:

```text
Daily exam calendar
Weekly exam calendar
By class
By subject
By room
By proctor
```

to make planning easier.

---

## R2.14-13 — Pre-Exam Eligibility Check

**Decision:** LOCKED

Before exam entry, the system validates:

```text
Identity
Participant eligibility
Schedule
Exam status
Session policy
Device readiness
Required security controls
```

---

## R2.14-14 — Explicit Exam Session

**Decision:** LOCKED

Participant assignment and actual exam attempt/session are separate entities.

```text
Participant
↓
Exam Session / Attempt
↓
Device / Session Context
↓
Answer State
↓
Submission
```

This enables recovery, retake, incidents, termination, and audit.

---

## R2.14-15 — Autosave Has Server Acknowledgement

**Decision:** LOCKED

Candidate answer persistence states:

```text
LOCAL_CHANGE
SAVING
SERVER_ACKNOWLEDGED
SAVED
RETRYING
OFFLINE_PENDING
RECOVERING
```

The UI must not display a false “saved” state before durable server acknowledgement according to the final persistence architecture.

---

## R2.14-16 — Answer Persistence Is Independent From Proctor Realtime

**Decision:** LOCKED

```text
ANSWER PERSISTENCE
≠
PROCTOR REALTIME
```

Proctor dashboard degradation must not cause answer loss.

---

## R2.14-17 — Submission Is Idempotent

**Decision:** LOCKED

Repeated submit requests caused by reconnect/retry must resolve to one logical final submission where business rules require a single submission.

---

## R2.14-18 — Final Submission Confirmation

**Decision:** LOCKED

After successful final submission, the student receives clear confirmation including an appropriate reference/status and timestamp.

---

## R2.14-19 — Server-Authoritative Timing

**Decision:** LOCKED

Exam timing must use a server-authoritative source with client display and reconnect reconciliation.

Client timer alone is not trusted as the source of truth.

---

## R2.14-20 — Refresh / Crash / Disconnect Recovery

**Decision:** LOCKED

The system must define recovery behavior for:

```text
Browser refresh
Tab crash
App close
Network disconnect
Device restart
```

Recovery remains bound by exam session/device security policy.

---

## R2.14-21 — Distraction-Free Formal Exam UI

**Decision:** LOCKED

The student exam runtime should remain simple and familiar, inspired by formal CBT/CPNS-style patterns without cloning another system.

Candidate UI:

```text
Exam status/header
Timer
Question number
Question content
Optional media
Answer options/field
Previous / Next
Question palette
Save/connection state
Battery/device state where supported
Submit
```

Passport, Path, Partner, general Home content, and other unrelated modules do not appear during active exam runtime.

---

## R2.14-22 — Configurable Question Navigation

**Decision:** LOCKED

Candidate policies:

```text
FREE_NAVIGATION
SEQUENTIAL
NO_BACKTRACK
SECTION_BASED
```

Final allowed policies may depend on exam type/security level.

---

## R2.14-23 — Randomization Is Reproducible and Auditable

**Decision:** LOCKED

Potential randomization:

```text
Question order
Option order
Question pool selection
Exam package
```

The exact delivered order/package must remain reconstructable for grading, appeals, and incident investigation.

---

## R2.14-24 — Submission and Grading Are Separate

**Decision:** LOCKED

```text
SUBMITTED SAFELY
↓
Auto-grade objective questions
↓
Manual review where required
↓
Final score
```

Submission must not wait on non-essential grading/analytics work.

---

## R2.14-25 — Auto + Manual Grading

**Decision:** LOCKED

Initial multiple-choice focus supports auto-grading.

Future subjective/essay types may require manual grading and rubric support.

---

## R2.14-26 — Score Correction Preserves Audit History

**Decision:** LOCKED

```text
Old Score
↓
Correction
↓
Reason
↓
New Score
↓
Actor
↓
Audit
```

No silent overwrite.

---

## R2.14-27 — Retake / Remedial Creates a New Attempt

**Decision:** LOCKED

Historical attempts remain preserved.

```text
Attempt 1
↓
Retake / Remedial
↓
Attempt 2
```

Final-score policy is separate and configurable.

---

## R2.14-28 — Incident Handling

**Decision:** LOCKED

Authorized staff may document incidents such as:

```text
Device failure
Electricity outage
Network outage
Student illness
System incident
Proctor action
```

and apply approved resolution:

```text
Resume
Extend time
New attempt
Invalidate
Manual review
```

All significant actions are audited.

---

## R2.14-29 — Exam Data Is Selectively Promoted to Passport

**Decision:** LOCKED

Routine exam results do not automatically flood Passport.

Only relevant, verified, meaningful, policy-approved records may become Passport records.

---

## R2.14-30 — Assessment Analytics Run After Core Safety

**Decision:** LOCKED

Candidate analytics:

```text
Score distribution
Question difficulty
Discrimination
Item analysis
Class comparison
Remedial indicators
```

Analytics should be asynchronous/non-blocking relative to final submission.

---

## R2.14-31 — Question Import / Export

**Decision:** LOCKED

Question Bank should support controlled import/export such as:

```text
Excel template
Validation
Preview
Error report
Duplicate handling
```

Additional formats may be added later.

---

## R2.14-32 — Archive Is Different From Delete

**Decision:** LOCKED

Exam lifecycle:

```text
FINALIZED
↓
ARCHIVED
```

Archive preserves history for:

```text
Audit
Student history
LPTPAT
Analytics
Appeal
Passport evidence
School accountability
```

Any later delete capability must obey retention, provenance, and evidence rules.

---

## R2.14-33 — Assessment Priority / Emergency Mode

**Decision:** LOCKED

During severe load/incidents, ELLIGBLE should be able to prioritize:

```text
Exam Session
Answer Persistence
Autosave
Submission
Required Security
```

while delaying/reducing non-critical work such as:

```text
Heavy analytics
General indexing
Partner processing
Path recommendations
Other non-critical jobs
```

Final trigger/automation design remains subject to architecture discovery.

---

## R2.14-34 — Billing Cannot Break Active Exams

**Decision:** LOCKED

Billing/commercial enforcement must never sit in the active answer-persistence/submission path.

A billing issue must not terminate an already active exam or prevent safe final submission.

---

## R2.14-35 — Assessment Has Dedicated Disaster-Recovery Objectives

**Decision:** LOCKED

Assessment should later have stricter targets for:

```text
Backup
Restore verification
Availability
Data-loss tolerance
Incident response
Recovery objectives
```

than ordinary non-critical product capabilities.

---

## R2.14 Consolidated Result

```text
R2.14-01 Assess Mission Critical                 → LOCKED
R2.14-02 Question Bank + Archive/Delete          → LOCKED — EXPANDED
R2.14-03 Question Ownership                      → LOCKED
R2.14-04 Initial MCQ / Extensible Types          → LOCKED — CLARIFIED
R2.14-05 Question Media                          → LOCKED
R2.14-06 Lifecycle + Archived Delete             → LOCKED — EXPANDED
R2.14-07 Immutable Published Snapshot            → LOCKED
R2.14-08 Exam Type / Generated Label             → LOCKED — EXPANDED
R2.14-09 Exam Templates                          → LOCKED
R2.14-10 Participant Assignment                  → LOCKED
R2.14-11 Exam Room                               → LOCKED
R2.14-12 Schedule Conflict Prevention            → LOCKED — EXPANDED
R2.14-13 Eligibility Check                       → LOCKED
R2.14-14 Exam Session / Attempt                  → LOCKED
R2.14-15 Autosave Acknowledgement                → LOCKED
R2.14-16 Persistence ≠ Proctor Realtime          → LOCKED
R2.14-17 Idempotent Submission                   → LOCKED
R2.14-18 Submission Confirmation                 → LOCKED
R2.14-19 Server-Authoritative Timer              → LOCKED
R2.14-20 Session Recovery                        → LOCKED
R2.14-21 Formal Distraction-Free UI              → LOCKED
R2.14-22 Configurable Navigation                 → LOCKED
R2.14-23 Auditable Randomization                 → LOCKED
R2.14-24 Submission vs Grading                   → LOCKED
R2.14-25 Auto / Manual Grading                   → LOCKED
R2.14-26 Score Correction Audit                  → LOCKED
R2.14-27 Retake / Remedial Attempt               → LOCKED
R2.14-28 Incident Handling                       → LOCKED
R2.14-29 Selective Passport Promotion            → LOCKED
R2.14-30 Async Analytics                         → LOCKED
R2.14-31 Question Import / Export                → LOCKED
R2.14-32 Archive ≠ Delete                        → LOCKED
R2.14-33 Assessment Emergency Mode               → LOCKED
R2.14-34 Billing Isolation                       → LOCKED
R2.14-35 Assessment DR Objectives                → LOCKED
```

These decisions supersede conflicting Assess/CBT recovery assumptions.

---

# 22. Anti-Cheating Recovery

Recovered anti-cheating ideas:

```text
Tab / focus loss detection
Fullscreen enforcement
Copy-paste detection
One account / one device
Device information
Battery information
Network information
IP context
Approximate location context
Question randomization
Option randomization
Camera / snapshot evidence
Violation event
Evidence log
Risk signals
Warning
Exam lock
Proctor unlock
Terminate session
Audit trail
False-positive handling
Student objection
```

**Status:** LOCKED as direction, individual mechanisms PROVISIONAL until feasibility/security discovery.

Important rule:

> Browser, Android, iOS, tablet, and desktop cannot be assumed to provide identical anti-cheating capabilities.

A Platform Capability Matrix is required.

---


# 22A. RECOVERY-R2.15 Review Outcome — Proctoring & Anti-Cheating

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.15  
**Owner Approval:** APPROVED — SELECTIVE EXPANSIONS / CHANGES

The Platform Owner approved the overall Proctoring & Anti-Cheating direction with explicit changes to security presets, concurrent-session handling, fullscreen enforcement, copy/paste/inspect restrictions, screenshot evidence, and AI policy.

---

## R2.15-01 — Layered Anti-Cheating

**Decision:** LOCKED

ELLIGBLE anti-cheating uses a layered model:

```text
Prevention
+
Detection
+
Evidence
+
Risk Signals
+
Proctor Control
+
Audit
```

ELLIGBLE must not claim that cheating can be prevented with 100% certainty.

---

## R2.15-02 — Security Presets Are Templates + Explicit Feature Toggles

**Decision:** LOCKED — EXPANDED

Security presets are intended to simplify configuration, but teachers/admins must still be able to see which anti-cheating controls are enabled.

Candidate presets:

```text
STANDARD
STRICT
HIGH SECURITY
CUSTOM
```

Each preset should resolve into explicit feature switches.

Candidate feature switches:

```text
Require Fullscreen
Detect Tab / Focus Loss
Block Copy
Block Paste
Block Cut
Block Context Menu
Block Common Inspect / DevTools Shortcuts where technically possible
Detect Inspect / DevTools signals where technically possible
Single Active Exam Session
Takeover on Second Active Session
Periodic Screenshot
Violation-Triggered Screenshot
Camera Required
Battery Monitoring
Network Monitoring
Location Signal
Device Change Requires Approval
Auto-Lock on Selected Violation
Manual Proctor Lock
Risk Scoring
Warning Overlay
```

### Example

A teacher may choose:

```text
Preset: CUSTOM

✓ Require Fullscreen
✓ Detect Tab Switch
✗ Camera Required
✗ Location Signal
✓ Violation Screenshot
✓ Block Copy / Paste / Cut
```

or:

```text
Preset: STRICT

✓ Require Fullscreen
✓ Detect Tab Switch
✓ Block Copy / Paste / Cut
✓ Violation Screenshot
✓ Single Active Session
✓ Network Monitoring
```

### Publish Summary

Before an exam is published, the teacher/admin should see a clear security summary:

```text
Security Profile:
STRICT

Enabled:
- Fullscreen required
- Tab/focus detection
- Copy/paste/cut blocked
- Violation screenshot
- Single active session
- Network monitoring
```

This prevents hidden or accidental security configuration.

### Compatibility Awareness

If a feature is unsupported on the current platform, the UI must not pretend it is active.

Candidate states:

```text
ENABLED
DISABLED
PARTIALLY_SUPPORTED
UNAVAILABLE_ON_PLATFORM
```

The final mapping is driven by the Device Capability Matrix.

---

## R2.15-03 — Pre-Exam Device Check

**Decision:** LOCKED

Before exam entry, required capabilities should be checked when relevant:

```text
Browser / App compatibility
Fullscreen support
Camera permission if required
Network
Battery
Storage
App/browser version
Required permission
```

The objective is to catch preventable issues before the exam begins.

---

## R2.15-04 — Concurrent Active Session: Deterministic Takeover With Timer Continuity

**Decision:** LOCKED — EXPANDED WITH DATA-SAFETY SAFEGUARD

Default policy for the same participant / same exam attempt:

> **Only one active exam session is allowed.**

If a second valid session is successfully established for the same attempt:

```text
Session 2 accepted
↓
Session 1 becomes TERMINATED_SUPERSEDED
↓
Session 1 can no longer write active answers
↓
Server-authoritative exam timer continues from the original attempt
↓
Session 2 continues with the remaining time
```

### Requested Answer Reset Behavior

The Platform Owner requested that answers from Session 1 should no longer remain as the active answer set after the second session takeover.

To preserve zero-lost-answer, auditability, and false-positive review:

> **The answers are removed from the active scoring/working state, but are NOT physically destroyed from protected audit/recovery history.**

Preferred model:

```text
Session 1 active answers
↓
TAKEOVER EVENT
↓
Snapshot preserved in protected audit/recovery store
↓
Active answer state reset / invalidated according to exam policy
↓
Session 2 receives the continuing attempt with remaining time
```

This achieves the intended consequence without erasing evidence.

### Timer Rule

The second session does NOT receive a fresh duration.

Example:

```text
Exam duration: 90 minutes

Student uses Session 1 for 37 minutes
↓
Second active session accepted
↓
Session 1 terminated
↓
Session 2 remaining time ≈ 53 minutes
```

Server-authoritative timing remains unchanged.

### Important Safety Rule

A mere stale browser tab or reconnect race must not trigger destructive takeover logic without the server confirming a genuinely concurrent active session according to the final session model.

The exact takeover handshake will be defined during Assessment Session architecture.

---

## R2.15-05 — Device Binding Uses Signals, Not Absolute Hardware Identity

**Decision:** LOCKED

Device context may include:

```text
Platform
Browser / App
OS
Session identifier
Device capability
Network context
```

Browser-derived device information is treated as a signal, not perfect hardware identity.

---

## R2.15-06 — Device Change Is Controlled and Must Not Conflict With Session-Takeover Rules

**Decision:** LOCKED — CLARIFIED

Legitimate device replacement remains supported.

Example:

```text
Device failure
↓
Student reports incident
↓
Proctor authorizes device transfer
↓
Old session revoked / terminated
↓
New session activated
↓
Remaining timer continues
↓
Approved answer recovery/reset policy applied
↓
Audit
```

This flow must be reconciled with the R2.15-04 single-active-session takeover rule.

A proctor-approved device transfer must be distinguishable from an unauthorized second login.

---

## R2.15-07 — Fullscreen Is Mandatory During Active Exam

**Decision:** LOCKED — STRENGTHENED

For supported web/browser exam runtime:

> **Fullscreen is mandatory while taking the exam.**

Exiting fullscreen produces a violation signal.

Candidate flow:

```text
Exam begins
↓
Fullscreen required
↓
Student exits fullscreen
↓
Violation recorded
↓
Student instructed / forced to return where technically possible
↓
Further enforcement according to security profile
```

Platform limitations must still be acknowledged.

On platforms where reliable fullscreen enforcement is unavailable, the Device Capability Matrix must show the limitation clearly.

---

## R2.15-08 — Tab / App Focus Detection

**Decision:** LOCKED

Events such as:

```text
Tab switch
Window blur
App background
Focus loss
```

are recorded as anti-cheating signals.

Context must be preserved because operating-system/browser behavior can produce false positives.

---

## R2.15-09 — Copy / Paste / Cut / Inspect Restrictions

**Decision:** LOCKED — CHANGED / STRENGTHENED

During active exam runtime, ELLIGBLE should attempt to prohibit:

```text
Copy
Paste
Cut
Context menu where appropriate
Common inspect/devtools keyboard shortcuts where technically possible
Other obvious in-page extraction shortcuts where technically possible
```

### Important Capability Boundary

Web browsers cannot guarantee complete control over the operating system or every developer-tool access path.

Therefore implementation must distinguish:

```text
BLOCKABLE
DETECTABLE
NOT RELIABLY CONTROLLABLE
```

ELLIGBLE must not falsely claim that browser Inspect/DevTools can always be completely prevented.

Where complete prevention is impossible:

- block common routes where possible;
- detect relevant focus/context signals where possible;
- record evidence;
- apply risk/policy rules;
- provide stronger controls later in native applications where platform APIs allow them.

---

## R2.15-10 — Keyboard Shortcut / Context Menu Restrictions

**Decision:** LOCKED

Security profiles may restrict relevant browser-level shortcuts/context menu where technically feasible.

These controls do not imply full operating-system control.

---

## R2.15-11 — Screenshot / Screen-Recording Strategy

**Decision:** LOCKED — CLARIFIED

For the initial web-first implementation, screenshot prevention is not treated as a guaranteed capability.

Initial evidence strategy should focus on:

```text
Periodic Screenshot
and/or
Violation-Triggered Screenshot
```

where camera/screen capture architecture and consent permit.

Other capabilities such as stronger screenshot/screen-record prevention remain FUTURE and platform-dependent.

### Future Capability

Native Android/iOS applications may later implement stronger controls where the operating system allows them.

---

## R2.15-12 — Camera Evidence Is Policy-Based

**Decision:** LOCKED

Candidate use:

```text
Initial identity snapshot
Periodic snapshot
Violation-triggered snapshot
Manual proctor request
```

Not every exam must require camera evidence.

---

## R2.15-13 — Evidence Capture Should Be Resource-Efficient

**Decision:** LOCKED

Continuous video recording is not the default baseline because of:

```text
Bandwidth
Storage
Privacy
Battery
Cost
```

Periodic/event-based evidence is preferred for the initial web-first stage.

---

## R2.15-14 — AI Proctoring / Face Recognition Is FUTURE Only

**Decision:** LOCKED — FUTURE ONLY

AI-based capabilities such as:

```text
Face recognition
Face presence detection
Multiple-person detection
AI anomaly detection
AI proctoring
AI risk classification
```

are NOT baseline requirements.

The initial ELLIGBLE system must operate fully without an AI subscription/provider.

Any future AI capability must:

```text
Be optional
Use provider abstraction
Be replaceable
Fail safely
Not block core product functionality
Not become required for Assessment submission
```

Accuracy, bias, privacy, cost, and false-positive risks must be reviewed before activation.

---

## R2.15-15 — Battery Is an Operational Signal

**Decision:** LOCKED

Battery status may be shown to student/proctor where technically supported.

Battery level is NOT cheating evidence.

---

## R2.15-16 — Network Health Is an Operational Signal

**Decision:** LOCKED

Candidate states:

```text
ONLINE
UNSTABLE
RECONNECTING
OFFLINE
RECOVERED
```

Network problems do not automatically imply misconduct.

---

## R2.15-17 — IP / Network Context Is Not Location Proof

**Decision:** LOCKED

IP/network context may contribute to risk/context but must not be treated as definitive physical-location evidence.

---

## R2.15-18 — Location Is a Risk / Context Signal

**Decision:** LOCKED

Location may be used where exam policy permits.

Location alone is insufficient for automatic termination.

---

## R2.15-19 — School / Exam Venue Baseline

**Decision:** LOCKED

School or exam venue context may be configured for relevant exams.

Multiple signals should be considered rather than relying only on school Wi-Fi/IP.

---

## R2.15-20 — Standardized Violation Event Model

**Decision:** LOCKED

Candidate fields:

```text
event_id
exam_session_id
student
type
timestamp
severity
platform
context
evidence_reference
risk_contribution
resolution_status
```

---

## R2.15-21 — Violation Severity Levels

**Decision:** LOCKED

Candidate levels:

```text
INFO
LOW
MEDIUM
HIGH
CRITICAL
```

Severity is defined by the exam security profile and event context.

---

## R2.15-22 — Risk Score Is Not a Verdict

**Decision:** LOCKED

```text
Risk ≠ Proven Cheating
```

Risk/evidence supports proctor review and policy enforcement.

---

## R2.15-23 — Rule-Based Risk Engine First, AI Later

**Decision:** LOCKED — AI FUTURE

Initial anti-cheating/risk logic should be deterministic and explainable.

Example:

```text
Repeated focus loss
+ repeated fullscreen exit
+ unauthorized second-session attempt
→ elevated risk
```

AI-based risk scoring remains FUTURE and optional.

The baseline product must not require paid AI services.

---

## R2.15-24 — Realtime Proctor Dashboard

**Decision:** LOCKED

Candidate student card summary:

```text
Name / Photo
Class
Exam status
Progress
Save state
Network
Battery
Device
Risk
Violation count
Location signal where used
Last activity
```

Detailed information should open contextually rather than overcrowding the card.

---

## R2.15-25 — Clear Student Exam Status

**Decision:** LOCKED

Candidate statuses:

```text
NOT_JOINED
CHECKING_DEVICE
READY
ACTIVE
UNSTABLE
LOCKED
SUBMITTED
TERMINATED
DISCONNECTED
INCIDENT
```

---

## R2.15-26 — Proctor Warning / Instruction

**Decision:** LOCKED

Authorized proctors may send warnings/instructions.

All significant actions are audited.

---

## R2.15-27 — Exam Lock

**Decision:** LOCKED

Serious events may move the active session to:

```text
LOCKED
```

Existing answers remain protected according to the active answer/audit policy.

---

## R2.15-28 — Controlled Unlock

**Decision:** LOCKED

Unlock should use a controlled flow:

```text
Proctor selects session
↓
Reason
↓
Authorize unlock
↓
Optional short-lived code
↓
Unlock
↓
Audit
```

Any code used should be short-lived, session/exam-specific, and not a global static password.

---

## R2.15-29 — Terminate Exam

**Decision:** LOCKED

Authorized termination requires:

```text
Reason
Confirmation
Relevant context/evidence
Actor
Timestamp
Audit
```

---

## R2.15-30 — Termination Must Preserve Evidence

**Decision:** LOCKED — CLARIFIED

Termination must not physically destroy historical answer/evidence data needed for review, fraud investigation, appeal, or audit.

If policy requires invalidating an answer set, the system should change its active/scoring status while preserving protected history.

---

## R2.15-31 — False-Positive Review

**Decision:** LOCKED

Candidate resolution states:

```text
VALID
FALSE_POSITIVE
EXCUSED
UNRESOLVED
```

---

## R2.15-32 — Appeal for High-Stakes Exams

**Decision:** LOCKED

High-stakes exams may enable:

```text
Student Appeal
↓
Evidence Review
↓
Decision
↓
Audit
```

---

## R2.15-33 — Evidence Retention Policy

**Decision:** LOCKED

Retention may depend on:

```text
Exam type
Security level
School policy
Appeal period
Legal/privacy requirement
```

Expired evidence is deleted/anonymized according to policy without destroying required audit lineage.

---

## R2.15-34 — Proctor Scope Is Session / Room Bound

**Decision:** LOCKED

Proctor access is scoped by:

```text
Exam
Session / Room
Tenant
Validity Window
```

---

## R2.15-35 — Proctor Actions Are Also Audited / Risk-Monitored

**Decision:** LOCKED

Candidate sensitive actions:

```text
Mass unlock
Repeated terminate
Evidence access
Manual time extension
Device/session transfer
Bulk incident action
```

Internal misuse/fraud must also be detectable.

---

## R2.15-36 — Time Extension for Legitimate Incidents

**Decision:** LOCKED

Authorized time extension records:

```text
duration
reason
actor
student
timestamp
incident reference
```

---

## R2.15-37 — School-Wide / Room-Wide Incident Handling

**Decision:** LOCKED

Candidate flow:

```text
Declare Incident
↓
Select affected room/session
↓
Pause / extend / recover according to policy
↓
Audit bulk action
```

---

## R2.15-38 — Assessment Emergency Mode + Graceful Proctor Degradation

**Decision:** LOCKED

During high load/incidents, priority remains:

```text
Answer persistence
Submission
Session security
```

Proctor realtime may degrade gracefully rather than jeopardizing exam persistence.

---

## R2.15-39 — No Silent Automatic Punishment

**Decision:** LOCKED

Default principle:

> Detection creates evidence/signals. Major enforcement follows deterministic policy and/or authorized proctor action.

Deterministic cases such as confirmed unauthorized concurrent session may be automatically blocked/terminated according to the locked session policy.

---

## R2.15-40 — Audit Replay

**Decision:** LOCKED

Authorized reviewers should be able to reconstruct a timeline of relevant session events for investigation and appeal.

---

## R2.15-41 — Global AI Policy for ELLIGBLE

**Decision:** LOCKED — BASELINE NO-AI

All AI-powered capabilities across ELLIGBLE are classified as:

```text
FUTURE
OPTIONAL
NON-BLOCKING
```

Baseline ELLIGBLE must be fully usable without any AI subscription or paid AI provider.

This applies to:

```text
Learn AI assistance
AI question generation
AI feedback
AI recommendations
AI Path matching
AI proctoring
AI face detection
AI fraud detection
AI analytics
AI support assistant
Other future AI features
```

Architecture should still keep an `AIProviderPort` / equivalent abstraction available for future expansion.

However:

```text
AI unavailable
≠
ELLIGBLE unavailable
```

and:

```text
No AI subscription
≠
Loss of core functionality
```

---

## R2.15 Consolidated Result

```text
R2.15-01 Layered Anti-Cheating                      → LOCKED
R2.15-02 Security Preset + Explicit Toggles         → LOCKED — EXPANDED
R2.15-03 Pre-Exam Device Check                      → LOCKED
R2.15-04 Concurrent Session Takeover                → LOCKED — EXPANDED
R2.15-05 Device Signals                             → LOCKED
R2.15-06 Controlled Device Change                   → LOCKED — CLARIFIED
R2.15-07 Mandatory Fullscreen                       → LOCKED — STRENGTHENED
R2.15-08 Focus / Tab Detection                      → LOCKED
R2.15-09 Copy/Paste/Cut/Inspect Restrictions        → LOCKED — CHANGED
R2.15-10 Shortcut / Context Menu Restrictions       → LOCKED
R2.15-11 Screenshot Strategy                        → LOCKED — CLARIFIED
R2.15-12 Camera Evidence                            → LOCKED
R2.15-13 Efficient Evidence Capture                 → LOCKED
R2.15-14 AI Proctoring                              → FUTURE ONLY
R2.15-15 Battery Signal                             → LOCKED
R2.15-16 Network Signal                             → LOCKED
R2.15-17 IP Context                                 → LOCKED
R2.15-18 Location Signal                            → LOCKED
R2.15-19 Venue Baseline                             → LOCKED
R2.15-20 Violation Event Model                      → LOCKED
R2.15-21 Severity                                   → LOCKED
R2.15-22 Risk ≠ Verdict                             → LOCKED
R2.15-23 Rule-Based Risk / AI Future                → LOCKED
R2.15-24 Realtime Proctor Dashboard                 → LOCKED
R2.15-25 Student Status Model                       → LOCKED
R2.15-26 Warning / Instruction                      → LOCKED
R2.15-27 Exam Lock                                  → LOCKED
R2.15-28 Controlled Unlock                          → LOCKED
R2.15-29 Terminate                                  → LOCKED
R2.15-30 Preserve Evidence on Terminate             → LOCKED
R2.15-31 False-Positive Review                      → LOCKED
R2.15-32 Appeal                                     → LOCKED
R2.15-33 Evidence Retention                         → LOCKED
R2.15-34 Proctor Scope                              → LOCKED
R2.15-35 Proctor Fraud Monitoring                   → LOCKED
R2.15-36 Time Extension                             → LOCKED
R2.15-37 Bulk Incident Handling                     → LOCKED
R2.15-38 Emergency / Graceful Degradation           → LOCKED
R2.15-39 No Silent Punishment                       → LOCKED
R2.15-40 Audit Replay                               → LOCKED
R2.15-41 Global Baseline No-AI Policy               → LOCKED
```

These decisions supersede conflicting Proctoring/Anti-Cheating and AI assumptions.

---

# 23. Proctoring Recovery

Candidate proctor dashboard:

- exam room/session monitoring;
- realtime participant cards;
- participant status;
- device information;
- battery;
- network;
- IP/location context;
- violation counter;
- evidence;
- lock/unlock;
- terminate session;
- incident notes;
- filter/search;
- room view;
- bulk monitoring;
- responsive tablet view.

**Status:** PROVISIONAL with strong legacy reference.

Desktop/large-screen remains priority for full monitoring.

---

# 24. Track Recovery

Candidate:

- academic progress;
- assessment trend;
- learning progress;
- attendance;
- achievements;
- longitudinal development;
- risk indicator;
- early warning;
- teacher follow-up;
- student self-view.

**Status:** PROVISIONAL.

OPEN:

- ranking;
- benchmark visibility;
- risk scoring logic;
- what data parents can see.

---


# 24A. RECOVERY-R2.16 Review Outcome — LPTPAT / Track / Academic Intelligence

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.16  
**Owner Approval:** APPROVED — ITEM 2 EXPANDED, FUNCTIONAL MAPPING CLARIFIED

The Platform Owner approved the overall LPTPAT / Track direction and requested explicit treatment for incomplete historical data when ELLIGBLE begins mid-student-lifecycle, plus clarification of where the historical LPTPAT functions live inside the broader ELLIGBLE product.

---

## R2.16-01 — Track Is the Product-Facing Academic Progress Workspace

**Decision:** LOCKED

`Track` is the primary product-facing workspace for longitudinal academic development.

The historical concept:

> **LPTPAT — Layanan Portofolio dan Tracking Prestasi Akademik Transparan**

is retained as an important product lineage/concept, but its functions are distributed across bounded domains rather than forcing all capabilities into one technical module.

---

## R2.16-02 — Longitudinal Academic Record Supports Partial History / Late Adoption

**Decision:** LOCKED — EXPANDED

Track must support students whose schools begin using ELLIGBLE after the student's academic journey has already started.

Example:

```text
Student enters ELLIGBLE in Grade XI

Grade X
→ no native ELLIGBLE history yet

Grade XI
→ native ELLIGBLE tracking begins

Grade XII
→ continues normally
```

The system must NOT display missing Grade X data as:

```text
0
FAILED
NO ACHIEVEMENT
```

because absence of imported data is not equivalent to poor performance.

### Historical Coverage State

Each relevant period should distinguish states such as:

```text
NATIVE
IMPORTED
PARTIAL
NOT_AVAILABLE
NOT_APPLICABLE
```

Example:

```text
Grade X    → NOT_AVAILABLE
Grade XI   → NATIVE
Grade XII  → NATIVE
```

or, if the school imports old report data:

```text
Grade X    → IMPORTED
Grade XI   → NATIVE
Grade XII  → NATIVE
```

### UI Rule

Track should communicate data coverage clearly.

Example:

```text
Kelas X
Data historis belum tersedia di ELLIGBLE.

Kelas XI
Data aktif sejak Juli 2026.
```

The UI must never fabricate trend continuity.

### Optional Historical Backfill

Schools may later backfill selected historical data through controlled import.

Candidate historical inputs:

```text
Report grades
Attendance summary
Achievements
Certificates
Academic status
Selected portfolio
Prior remediation records where lawful/relevant
```

Import flow:

```text
Upload / Entry
↓
Validation
↓
Preview
↓
Source / Period Mapping
↓
Confirmation
↓
Imported Historical Record
↓
Audit
```

Imported records must retain provenance.

Example:

```text
Source: School Historical Import
Academic Year: 2025/2026
Verification: School-Imported / School-Verified
```

They must not be presented as if generated natively by ELLIGBLE.

### Partial History and Analytics

Trend calculations must account for incomplete data.

Example:

```text
Grade X → NOT_AVAILABLE
Grade XI Sem 1 → 78
Grade XI Sem 2 → 84
```

The system may show:

```text
Trend since ELLIGBLE tracking began: +6
```

but must NOT claim:

```text
Improved continuously from Grade X
```

without Grade X evidence.

### Student Transfer

The same principle applies to:

```text
Student transfer from non-ELLIGBLE school
Student transfer from another ELLIGBLE tenant
School joining ELLIGBLE mid-year
Late account activation
Historical import only for selected subjects
```

Portable verified history from another ELLIGBLE school can be retained according to Passport/transfer policy.

---

## R2.16-03 — Finalized Assessment Data Enters Track Asynchronously

**Decision:** LOCKED

Preferred flow:

```text
CBT ACTIVE
↓
SUBMISSION
↓
GRADING
↓
FINALIZATION
↓
Async Event
↓
Track / LPTPAT update
```

Track must not depend on unfinished live attempts.

---

## R2.16-04 — CBT Priority Lock

**Decision:** LOCKED

During live assessment, non-critical Track processing may be delayed.

```text
CBT safety
>
Track freshness
```

Potentially deferred work:

```text
Heavy analytics
Portfolio sync
Trend recalculation
Non-critical Track aggregation
```

---

## R2.16-05 — Academic Trend

**Decision:** LOCKED

Track may present longitudinal subject/performance trends with provenance and coverage context.

Example:

```text
Economics
Semester 1: 78
Semester 2: 84
Semester 3: 88
```

Incomplete periods must be clearly marked rather than treated as zero.

---

## R2.16-06 — Rule-Based Early Warning

**Decision:** LOCKED

Baseline Early Warning uses explainable deterministic rules rather than AI.

Candidate signals:

```text
Sustained grade decline
Attendance deterioration
Repeated missed assignments
Repeated remedial
Abrupt learning-progress decline
```

Outputs may be:

```text
NEEDS_ATTENTION
FOLLOW_UP_RECOMMENDED
```

Exact thresholds remain subject to dedicated discovery.

---

## R2.16-07 — Early Warning Is Not a Diagnosis

**Decision:** LOCKED

A system signal must not label or diagnose a student.

```text
Signal
≠
Judgment
≠
Diagnosis
```

Human teachers/counselors interpret context.

---

## R2.16-08 — Academic Targets

**Decision:** LOCKED

Students may set or receive academic targets such as:

```text
Subject score target
Attendance target
Assignment completion target
Competency target
```

Targets may be student-defined or agreed with authorized school staff.

---

## R2.16-09 — Teacher Academic Follow-Up

**Decision:** LOCKED

Track may support non-sensitive academic follow-up:

```text
Needs follow-up
Remedial assigned
Student consulted
Progress checked
Resolved
Further action required
```

Sensitive counseling notes belong to Care, not Track.

---

## R2.16-10 — Track and Care Are Separate but Connected

**Decision:** LOCKED

```text
TRACK
= academic development, academic signals, progress

CARE
= counseling, student support cases, private notes, interventions
```

A Track signal may create/referral a Care follow-up where authorized.

Example:

```text
Repeated academic decline
↓
Track Early Warning
↓
Teacher review
↓
Refer to BK / Care when needed
↓
Care Case
```

Track must not expose Care's confidential case contents back into general academic dashboards.

---

## R2.16-11 — Portfolio Tracking

**Decision:** LOCKED

Track may surface/collect potential development artifacts such as:

```text
Project
Achievement
Certificate
Competition
Activity
```

Validated artifacts may later be promoted to Passport.

---

## R2.16-12 — Attendance Trend

**Decision:** LOCKED

Where attendance data exists, Track may show patterns such as:

```text
Present
Late
Excused
Sick
Absent
Period trend
```

Visibility follows role and privacy policy.

---

## R2.16-13 — Student Self-View

**Decision:** LOCKED

Students should be able to see their own progress for:

```text
reflection
planning
improvement
```

The design should prioritize personal development over social comparison.

---

## R2.16-14 — Ranking Is Not the Default Center of Track

**Decision:** LOCKED

Default product hierarchy:

```text
Personal Progress
>
Contextual Benchmark
>
Ranking
```

Ranking may exist if school policy requires it, but must not dominate Track.

---

## R2.16-15 — Parent Track View Is Purpose-Limited

**Decision:** LOCKED

Guardian views may include relevant summaries:

```text
Academic trend
Attendance
Pending assignments
Needs-attention indicator
Progress
```

Private teacher/BK notes remain restricted.

---

## R2.16-16 — Leadership Insight Uses Aggregation

**Decision:** LOCKED

Authorized school leadership may view aggregated insights such as:

```text
School trend
Grade-level trend
Subject trend
Remedial rate
Attendance pattern
Support-needs count
```

The interface should avoid unnecessary exposure of individual private records.

---

## R2.16-17 — Cross-Subject Development View

**Decision:** LOCKED

Track may show patterns across subjects/competencies but must not collapse a student into one opaque “intelligence score.”

---

## R2.16-18 — Academic Intervention History

**Decision:** LOCKED

Academic intervention can be tracked as:

```text
Signal
↓
Academic Follow-up
↓
Remedial / Action
↓
Result
↓
Resolved / Escalated
```

If escalation enters counseling/private support, the detailed case moves into Care.

---

## R2.16-19 — Selective Track → Passport Promotion

**Decision:** LOCKED

Potential Passport candidates:

```text
Verified achievement
Verified competency
Important project
Certification
Standardized assessment
```

Routine trend data does not automatically become Passport content.

---

## R2.16-20 — “Transparent” Means Provenance, Not Public Visibility

**Decision:** LOCKED

The `Transparan` value from LPTPAT is preserved as:

```text
Known source
Historical lineage
Correction trail
Verification status
Auditable access
```

It does NOT mean every record is public.

---

## R2.16-21 — Analytics Is Asynchronous

**Decision:** LOCKED

Heavy Track aggregation/analytics must run outside mission-critical academic/Assessment transaction paths.

---

## R2.16-22 — AI Recommendations Are FUTURE Only

**Decision:** LOCKED — FUTURE ONLY

Baseline:

```text
Rules
Thresholds
Trend calculations
Deterministic indicators
```

AI recommendation is optional FUTURE functionality and is never required for Track.

---

# R2.16-A — Historical LPTPAT Function Mapping Into ELLIGBLE

**Decision:** LOCKED — PRODUCT ARCHITECTURE MAPPING

The historical LPTPAT functions are not removed.

They are mapped to the bounded domain that best owns the data and privacy responsibility.

```text
LPTPAT FUNCTION
                         ELLIGBLE HOME
────────────────────────────────────────────────────────
Tracking Akademik       → Track
Early Warning           → Track
Portofolio              → Track + Passport
Target PTN              → Path
BK & Intervensi         → Care
```

This is intentional bounded-domain separation, not feature loss.

---

## A1 — Tracking Akademik → TRACK

Track owns:

```text
Longitudinal grades
Assessment trend
Attendance trend
Learning progress
Remedial history
Academic targets
Academic follow-up
Cross-subject progress
Student self-view
```

Track is therefore the main continuation of LPTPAT's **Tracking Akademik** function.

---

## A2 — Early Warning → TRACK, Escalation to CARE

Track detects academic/operational warning signals using deterministic rules.

Example:

```text
Attendance declining
+ repeated remedial
+ incomplete assignments
↓
TRACK: NEEDS ATTENTION
```

Then:

```text
Teacher reviews
↓
Academic follow-up sufficient?
├── YES → resolve in Track
└── NO  → refer to Care / BK
```

Therefore:

```text
Detection / academic signal = TRACK
Sensitive intervention case = CARE
```

---

## A3 — Portofolio → TRACK + PASSPORT

Portfolio has two stages.

### Track

Track helps collect/develop:

```text
Projects
Activities
Achievements
Certificates
Competency evidence
Potential portfolio artifacts
```

### Passport

Once an artifact becomes meaningful and sufficiently verified:

```text
Track artifact
↓
Verification
↓
Passport eligibility
↓
Student approval where required
↓
Verified Passport Record
```

Therefore:

```text
TRACK
= development/workbench/history

PASSPORT
= portable trusted record
```

This avoids turning Passport into a dumping ground for every routine school artifact.

---

## A4 — Target PTN → PATH

The historical `Target PTN` function belongs primarily to ELLIGBLE **Path / Bridging Engine**.

Candidate student flow:

```text
Student goal
↓
Kuliah
↓
Target PTN / University
↓
Target study program
↓
Admission route
↓
Readiness / requirements
↓
Action plan
↓
Relevant opportunity / scholarship
↓
Outcome tracking
```

Path may consume approved inputs from:

```text
Track
Passport
Academic record
Competency
Student preferences
```

This is broader than PTN alone.

The architecture should allow:

```text
PTN
PTS
Politeknik
Sekolah Kedinasan where relevant
Overseas higher education
Scholarship pathways
```

Final destination taxonomy is subject to Path discovery.

The `Target PTN` concept is therefore retained but expanded into:

> **Higher-Education Target & Readiness inside Path.**

---

## A5 — BK & Intervensi → CARE

ELLIGBLE Care owns sensitive support/counseling/intervention workflows.

Candidate:

```text
Track Warning
Teacher Referral
Student Self-Request
Parent-authorized route where applicable
Other authorized school signal
↓
CARE
↓
Counselor / BK review
↓
Appointment / Case
↓
Intervention
↓
Follow-up
↓
Referral / Escalation
↓
Resolution
```

Care may contain:

```text
Counselor dashboard
Case management
Appointment
Private notes
Follow-up
Referral
Intervention history
Access restriction
Audit
```

Because BK data is sensitive, it must not be embedded as ordinary Track data.

Track may only receive safe outcome/state signals where appropriate, for example:

```text
REFERRED_TO_CARE
FOLLOW_UP_IN_PROGRESS
RESOLVED
```

not confidential counseling notes.

---

## A6 — Unified Student Experience Despite Bounded Domains

Although technically separated, the student/teacher experience should feel connected.

Example student journey:

```text
TRACK
Academic progress declines
↓
Early Warning
↓
Academic action suggested
↓
PATH
Target university readiness affected
↓
CARE
BK support if needed
↓
TRACK
Progress monitored
↓
PASSPORT
Verified achievement added
```

The user should not need to understand bounded-domain architecture.

ELLIGBLE presents one coherent superapp experience while maintaining data/privacy boundaries behind the UI.

---

## R2.16 Consolidated Result

```text
R2.16-01 Track Product Workspace                 → LOCKED
R2.16-02 Partial / Late-Adoption History         → LOCKED — EXPANDED
R2.16-03 Final Assessment → Track                → LOCKED
R2.16-04 CBT Priority Lock                       → LOCKED
R2.16-05 Academic Trend                          → LOCKED
R2.16-06 Rule-Based Early Warning                → LOCKED
R2.16-07 Warning ≠ Diagnosis                     → LOCKED
R2.16-08 Academic Targets                        → LOCKED
R2.16-09 Teacher Follow-Up                       → LOCKED
R2.16-10 Track ↔ Care Boundary                   → LOCKED
R2.16-11 Portfolio Tracking                      → LOCKED
R2.16-12 Attendance Trend                        → LOCKED
R2.16-13 Student Self-View                       → LOCKED
R2.16-14 Ranking Not Default                     → LOCKED
R2.16-15 Parent View                             → LOCKED
R2.16-16 Leadership Aggregates                   → LOCKED
R2.16-17 Cross-Subject View                      → LOCKED
R2.16-18 Intervention History                    → LOCKED
R2.16-19 Selective Passport Promotion            → LOCKED
R2.16-20 Transparency = Provenance               → LOCKED
R2.16-21 Async Analytics                         → LOCKED
R2.16-22 AI Future Only                          → LOCKED — FUTURE

LPTPAT MAPPING:
Tracking Akademik → Track                        → LOCKED
Early Warning     → Track → Care escalation      → LOCKED
Portofolio        → Track + Passport             → LOCKED
Target PTN        → Path                         → LOCKED
BK & Intervensi   → Care                         → LOCKED
```

These decisions supersede conflicting assumptions that all LPTPAT capabilities must live inside a single technical module.

---

# 25. Care / Counselor Recovery

Candidate:

- counselor dashboard;
- student support signal;
- counseling appointment;
- case management;
- private notes;
- follow-up;
- referral;
- escalation;
- access restriction;
- audit.

**Status:** PROVISIONAL.

High privacy/security sensitivity.

Detailed confidentiality model remains OPEN.

---


# 25A. RECOVERY-R2.17 Review Outcome — Care / BK & Intervensi

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.17  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Care / BK & Intervention direction.

---

## R2.17-01 — Care Is an Operational Student-Support Workspace

**Decision:** LOCKED

Care is not merely a repository of counseling notes.

Candidate capabilities:

```text
Early Warning Referral
Student Request
Teacher Referral
Counseling
Case Management
Intervention
Follow-up
Parent Coordination
External Referral
Resolution
```

---

## R2.17-02 — Student Self-Request

**Decision:** LOCKED

Students may request support directly without first being labeled by a teacher.

Candidate flow:

```text
Need Support
↓
General Category
↓
Counselor / Assignment
↓
Request Session
↓
Follow-up
```

---

## R2.17-03 — Track → Care Referral

**Decision:** LOCKED

Track may create a safe referral into Care.

Example:

```text
Repeated remedial
Attendance decline
Incomplete assignments
↓
Needs Attention
↓
Teacher review
↓
Refer to BK
↓
Care Case
```

Only relevant context is transferred; Care does not automatically ingest all Track data.

---

## R2.17-04 — Teacher / Homeroom Referral

**Decision:** LOCKED

Authorized teachers/homeroom teachers may create referrals containing:

```text
Student
Reason Category
Short Description
Urgency
Supporting Context
```

Referral permission does not imply permission to read all counseling case details.

---

## R2.17-05 — Case Is Different From Counseling Session

**Decision:** LOCKED

A single Care Case may contain multiple activities.

```text
CARE CASE
├── Counseling Session
├── Follow-up
├── Parent Coordination
├── Intervention
├── Referral
└── Resolution
```

---

## R2.17-06 — Case Lifecycle

**Decision:** LOCKED

Candidate lifecycle:

```text
NEW
TRIAGED
ASSIGNED
IN_PROGRESS
MONITORING
REFERRED
RESOLVED
CLOSED
REOPENED
```

Final naming remains subject to detailed Care discovery.

---

## R2.17-07 — Priority / Urgency

**Decision:** LOCKED

Candidate levels:

```text
NORMAL
ATTENTION
HIGH
URGENT
```

Urgency supports work prioritization and is not a diagnosis.

---

## R2.17-08 — Counseling Records Are Highly Private

**Decision:** LOCKED

Private counseling information is restricted by default.

Typical access may include:

```text
Assigned Counselor
Authorized BK Staff
Specifically Authorized School Leadership
```

It is not automatically visible to:

```text
All Teachers
Homeroom Teacher
Operator
Parent
Platform Support
Partner
```

---

## R2.17-09 — Safe Status Is Separate From Private Counselor Notes

**Decision:** LOCKED

Care should separate sharable operational status from confidential case content.

Example:

```text
Safe Status:
FOLLOW_UP_IN_PROGRESS

Private Counselor Note:
RESTRICTED
```

Other authorized modules/users may receive only safe state such as:

```text
REFERRED
IN_PROGRESS
RESOLVED
```

without confidential counseling content.

---

## R2.17-10 — Care Data Does Not Enter Passport

**Decision:** LOCKED

The following do not become ordinary Passport records:

```text
Counseling Notes
Intervention Details
Private Student Disclosure
Sensitive Family Circumstances
Private Case Records
```

They are also excluded from normal Partner access.

---

## R2.17-11 — Counseling Appointment Management

**Decision:** LOCKED

Candidate appointment fields:

```text
Date
Time
Counselor
Location / Room
Online / Offline
Status
```

Candidate statuses:

```text
REQUESTED
CONFIRMED
COMPLETED
CANCELLED
NO_SHOW
RESCHEDULED
```

---

## R2.17-12 — Counselor Workload Dashboard

**Decision:** LOCKED

Authorized BK staff may view work queues such as:

```text
Unassigned Cases
Assigned Cases
High Priority
Today's Appointments
Follow-ups Due
Cases Without Update
```

---

## R2.17-13 — Counselor Assignment / Reassignment

**Decision:** LOCKED

Cases may be assigned, reassigned, or transferred.

Changes preserve:

```text
Previous Counselor
New Counselor
Reason
Actor
Timestamp
Audit
```

---

## R2.17-14 — Intervention Plan

**Decision:** LOCKED

Candidate interventions:

```text
Counseling Session
Academic Follow-up
Attendance Monitoring
Teacher Coordination
Parent Meeting
Peer / Social Support
External Professional Referral
Other School-Approved Intervention
```

ELLIGBLE supports workflow/documentation and does not replace qualified professionals.

---

## R2.17-15 — Follow-Up Deadline & Reminder

**Decision:** LOCKED

Interventions may create follow-up obligations.

```text
Intervention
↓
Follow-up Date
↓
Reminder
↓
Review Outcome
```

Cases should not disappear after a single session without an explicit state transition.

---

## R2.17-16 — Outcome / Resolution

**Decision:** LOCKED

Candidate outcomes:

```text
Resolved
Monitoring Continued
Returned to Academic Follow-up
Referred Externally
Transferred to Authorized Counselor
Other
```

---

## R2.17-17 — Parent Involvement Is Controlled

**Decision:** LOCKED

Parents/guardians do not automatically receive full Care records.

Authorized counselors may manage:

```text
Parent Involvement Required
Parent Meeting Requested
General Status Share
Specific Approved Information
```

Confidential notes remain restricted unless a lawful/policy-based exception applies.

---

## R2.17-18 — Student Privacy, Consent & Authorized Escalation

**Decision:** LOCKED

Care must track:

```text
What may be shared
Why it may be shared
Who may receive it
Under which policy/authorization
```

Where school policy/law requires escalation, authorized action may occur with audit.

Detailed legal rules remain subject to Privacy/Legal discovery.

---

## R2.17-19 — Emergency / Safeguarding Escalation

**Decision:** LOCKED

Care must support urgent policy-based escalation.

Candidate flow:

```text
URGENT CASE
↓
Authorized Counselor Review
↓
Escalation According to School Policy
↓
Authorized Leadership / Guardian / Relevant Party
↓
Action Log
↓
Follow-up
```

ELLIGBLE does not make autonomous diagnoses.

---

## R2.17-20 — External Referral

**Decision:** LOCKED

Candidate external destinations:

```text
External Counselor
Psychologist
Health Service
Government / Support Institution
Other Authorized Service
```

Care may retain referral metadata and follow-up state.

External referral does not automatically grant external parties broad ELLIGBLE access.

---

## R2.17-21 — No AI Dependency

**Decision:** LOCKED

Baseline Care functionality uses deterministic workflows:

```text
Referral Rules
Priority
Reminder
Follow-up
Case Routing
Dashboard
```

AI summarization/recommendation/risk detection remains FUTURE, OPTIONAL, NON-BLOCKING.

---

## R2.17-22 — Sensitive Access Is Auditable

**Decision:** LOCKED

Candidate audit events include:

```text
Case Opened
Private Note Viewed
Case Edited
Case Exported
Case Reassigned
Intervention Added
Referral Created
Case Closed
```

Audit depth may vary by data sensitivity.

---

## R2.17-23 — Search Must Not Leak Care Existence

**Decision:** LOCKED

Global search must obey strict Care authorization.

Unauthorized users must not discover that a person has a counseling/care case merely through search results or indexing metadata.

---

## R2.17-24 — Export Is Highly Restricted

**Decision:** LOCKED

Care export requires:

```text
Authorized Role
Limited Scope
Reason where appropriate
Audit
Watermark / Reference where appropriate
```

Routine school operators must not have broad bulk export access to counseling records.

---

## R2.17-25 — Student Transfer Does Not Automatically Transfer Private Care History

**Decision:** LOCKED

Care records created by School A remain owned by School A according to retention/privacy rules.

If continuity requires sharing with School B:

```text
Approved Safe Transfer Summary
+
Authorized Purpose
+
Clear Provenance
```

may be used.

Full private counseling history is not automatically copied.

---

## R2.17-26 — Alumni Transition

**Decision:** LOCKED

At graduation:

```text
Active Student Care
→ Closed / Retained according to policy
```

Care records do not become Alumni Profile or Passport content.

---

## R2.17-27 — Leadership Uses Aggregated Care Insight

**Decision:** LOCKED

Authorized leadership may receive aggregated metrics such as:

```text
Active Case Count
General Category Distribution
Average Follow-up Time
Resolved Cases
Referral Rate
High-Priority Count
```

without automatic access to private counseling notes.

---

## R2.17-28 — Track ↔ Care Boundary

**Decision:** LOCKED

```text
TRACK
Academic Signals
↓
CARE
Counseling / Intervention
↓
TRACK
Safe Outcome Status Only
```

And by default:

```text
CARE
✗ Partner
✗ Passport
✗ Public Profile
```

unless a separately authorized, purpose-specific data flow is explicitly designed.

---

## R2.17-29 — Care UX Is Support-Oriented, Not Punitive

**Decision:** LOCKED

Care language/interface should emphasize:

```text
Needs Support
Follow-up
Progress
Intervention
Resolution
```

and avoid punitive labels such as:

```text
Bad Student
Blacklist
Problem Score
```

---

## R2.17-30 — Discipline / School Conduct Is Separate From Care

**Decision:** LOCKED

```text
DISCIPLINE / SCHOOL CONDUCT
≠
CARE / COUNSELING
```

A conduct event may trigger a Care referral when support is appropriate.

However:

- disciplinary records and counseling notes must not be stored as one undifferentiated record;
- Care remains a student-support domain;
- access and retention rules may differ;
- private counseling information must not become general disciplinary evidence.

---

## R2.17 Consolidated Result

```text
R2.17-01 Operational Care Workspace             → LOCKED
R2.17-02 Student Self-Request                   → LOCKED
R2.17-03 Track → Care Referral                  → LOCKED
R2.17-04 Teacher Referral                       → LOCKED
R2.17-05 Case ≠ Session                         → LOCKED
R2.17-06 Case Lifecycle                         → LOCKED
R2.17-07 Priority / Urgency                     → LOCKED
R2.17-08 Private Counseling Records             → LOCKED
R2.17-09 Safe Status vs Private Notes           → LOCKED
R2.17-10 No Care → Passport                     → LOCKED
R2.17-11 Appointments                           → LOCKED
R2.17-12 Counselor Workload                     → LOCKED
R2.17-13 Counselor Assignment                   → LOCKED
R2.17-14 Intervention Plan                      → LOCKED
R2.17-15 Follow-Up                              → LOCKED
R2.17-16 Resolution                             → LOCKED
R2.17-17 Controlled Parent Involvement          → LOCKED
R2.17-18 Privacy / Consent / Escalation         → LOCKED
R2.17-19 Emergency Escalation                   → LOCKED
R2.17-20 External Referral                      → LOCKED
R2.17-21 AI Future Only                         → LOCKED
R2.17-22 Sensitive Access Audit                 → LOCKED
R2.17-23 Search Privacy                         → LOCKED
R2.17-24 Restricted Export                      → LOCKED
R2.17-25 Transfer Privacy                       → LOCKED
R2.17-26 Alumni Transition                      → LOCKED
R2.17-27 Aggregate Leadership Insight           → LOCKED
R2.17-28 Track ↔ Care Boundary                  → LOCKED
R2.17-29 Support-Oriented UX                    → LOCKED
R2.17-30 Discipline ≠ Care                      → LOCKED
```

These decisions supersede conflicting assumptions that counseling, discipline, academic tracking, and Passport data should be stored in one undifferentiated student record.

---

# 26. Parent / Guardian Recovery

Candidate:

- child overview;
- attendance;
- learning progress;
- selected assessment results;
- school notifications;
- communication;
- approvals/consent;
- development alerts.

**Status:** LOCKED as domain concept; details OPEN.

OPEN:

- visibility into anti-cheating violations;
- messaging scope;
- multiple guardians;
- student privacy limits;
- legal/consent model.

---


# 26A. RECOVERY-R2.18 Review Outcome — Parent / Guardian Portal

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.18  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Parent / Guardian Portal direction.

---

## R2.18-01 — Parent Has an Independent Account

**Decision:** LOCKED

Parents/guardians must use their own ELLIGBLE identity/account.

```text
PARENT ACCOUNT
↓
Guardian Relationship
↓
Student A
Student B
...
```

Parents must not rely on the student's login credentials.

---

## R2.18-02 — One Student May Have Multiple Guardians

**Decision:** LOCKED

A student may have multiple verified guardian relationships, each with its own status and permitted scope.

---

## R2.18-03 — Guardian Account Can Span Multiple Tenants

**Decision:** LOCKED

A single global guardian account may relate to children enrolled in different ELLIGBLE school tenants.

Context switching must remain explicit and permissions must not mix across children/tenants.

---

## R2.18-04 — Guardian Relationship Must Be Verified

**Decision:** LOCKED

Candidate activation routes:

```text
School Provisioning
Verified Invitation
Guardian Claim + Verification
School Approval
Historical Import + Activation
```

Candidate relationship states:

```text
PENDING
VERIFIED
ACTIVE
REVOKED
EXPIRED
ENDED
```

A person cannot gain guardian access simply by searching for a student's name.

---

## R2.18-05 — Parent Home Is Child-Centric and Action-Oriented

**Decision:** LOCKED

Candidate Home priorities:

```text
Attendance
Schedule
Assignments / Deadlines
Upcoming Assessment
School Announcement
Academic Progress
Needs-Attention Item
Required Parent Action
```

Parent Home is not a social feed.

---

## R2.18-06 — Multi-Child Switching Must Be Simple and Safe

**Decision:** LOCKED

The interface should allow clear switching between children and school contexts while preventing cross-child data mixing.

---

## R2.18-07 — Parent Attendance Visibility

**Decision:** LOCKED

Parent may view relevant attendance states/trends such as:

```text
Present
Excused
Sick
Absent
Late
Attendance Trend
```

Corrections follow Academic Core history/audit rules.

---

## R2.18-08 — Parent Has a Summary Learn View

**Decision:** LOCKED

Candidate visibility:

```text
Pending Assignments
Deadline
Submission Status
Important Learning Activity
Remedial
Selected Teacher Feedback
```

Parent is not automatically enrolled as a class participant and cannot read unrestricted internal class discussion.

---

## R2.18-09 — Assessment Visibility Is Status-Oriented, Not Runtime Access

**Decision:** LOCKED

Parent may see:

```text
Upcoming Exam
Exam Completed
Result Published
Remedial Available
```

Parent must not see active exam questions, answers, proctor data, or runtime security evidence.

---

## R2.18-10 — Assessment Result Visibility Follows Release Policy

**Decision:** LOCKED

```text
Exam Finished
↓
Grading
↓
Finalized
↓
Result Released
↓
Parent View
```

Results are not automatically exposed before authorized release.

---

## R2.18-11 — Track Is the Main Academic Progress View for Parent

**Decision:** LOCKED

Candidate summaries:

```text
Grade Trend
Attendance Trend
Remedial
Learning Progress
Selected Academic Targets
Needs-Attention Signal
```

Parent view is intentionally different from teacher analytics.

---

## R2.18-12 — Early Warning Sharing Is Controlled

**Decision:** LOCKED

Not every internal Track signal is automatically pushed to parents.

Candidate flow:

```text
Track Signal
↓
Teacher / Counselor Review where required
↓
Parent-Shareable Status
↓
Parent Notification
```

This reduces harm from false positives or premature interpretation.

---

## R2.18-13 — Care Shares Only Safe Information

**Decision:** LOCKED

Parent may receive safe operational information such as:

```text
BK Meeting Scheduled
Support In Progress
Parent Meeting Required
Follow-up Completed
```

Private counselor notes and sensitive student disclosures remain restricted by default.

---

## R2.18-14 — Parent Can Receive Required Actions

**Decision:** LOCKED

Candidate actions:

```text
Confirm Permission
Attend Meeting
Complete Document
Confirm Activity
Acknowledge School Notice
```

Candidate states:

```text
PENDING
COMPLETED
EXPIRED
```

---

## R2.18-15 — School Announcements Can Be Targeted

**Decision:** LOCKED

Announcements may target:

```text
All Guardians
Specific Grade
Specific Class
Activity Participants
Selected Student Guardians
```

---

## R2.18-16 — Parent Notifications Are Actionable and Prioritized

**Decision:** LOCKED

Candidate priorities:

```text
CRITICAL
IMPORTANT
NORMAL
INFO
```

Non-critical preferences may be configurable where safe.

---

## R2.18-17 — Parent Is Not a Shadow Proctor

**Decision:** LOCKED

Parent has no default access to:

```text
Live Anti-Cheating Evidence
Exam Camera Snapshot
Violation Timeline
Exam Device Location
Proctor Dashboard
```

Only formally released school decisions/incidents may be shared where appropriate.

---

## R2.18-18 — Parent Passport Visibility Is Lifecycle-Aware

**Decision:** LOCKED

Guardian visibility into Passport is limited by policy, relationship, age/lifecycle, purpose, and consent.

Guardian access must not become permanent lifetime access after:

```text
Student
→ Graduate
→ Adult Alumni
```

---

## R2.18-19 — Parent Can Participate in Path Planning

**Decision:** LOCKED

Candidate parent-visible Path information:

```text
Target University
Target Study Program
Admission Route
Deadline
Readiness Summary
Scholarship Opportunity
Action Plan
```

Visibility follows student/policy rules.

---

## R2.18-20 — Parent Cannot Silently Override Student Goals

**Decision:** LOCKED

For decisions owned by the student:

```text
Parent Suggestion
↓
Student Review
↓
Accept / Reject
```

Parent input must not silently overwrite student-owned goals.

---

## R2.18-21 — Opportunity/Application Visibility Is Contextual

**Decision:** LOCKED

Parent may see selected opportunity/application status where policy/student permission allows.

More private recruitment/job applications are not automatically exposed.

---

## R2.18-22 — Parent Messaging Is Scoped

**Decision:** LOCKED

Future messaging may allow controlled relationships such as:

```text
Parent ↔ Homeroom Teacher
Parent ↔ Authorized Teacher
Parent ↔ Counselor where appropriate
Parent ↔ School Admin
```

Parent must not be able to freely message every ELLIGBLE user.

---

## R2.18-23 — Parent Cannot Access Other Students

**Decision:** LOCKED

Guardian access is strictly scoped to verified relationships.

No default access to:

```text
Other Students
Other Students' Grades
Other Students' Attendance
Other Students' Passport
Other Guardians
```

---

## R2.18-24 — Delegated Guardian Permissions

**Decision:** LOCKED

ELLIGBLE may support different guardian scopes, for example:

```text
Primary Guardian
Authorized Guardian
```

but final permission UX should remain manageable for schools.

---

## R2.18-25 — Relationship Termination Does Not Delete Global Guardian Identity

**Decision:** LOCKED

When a guardian relationship ends/revokes:

```text
Global Guardian Account
→ remains

Student Relationship
→ REVOKED / ENDED
```

---

## R2.18-26 — Student Transfer Preserves Guardian Identity

**Decision:** LOCKED

A transfer changes institutional relationships, not the guardian's global identity.

New-school guardian relationship may require activation/verification according to policy.

---

## R2.18-27 — Guardian Events Are Auditable

**Decision:** LOCKED

Candidate audit events:

```text
Guardian Linked
Guardian Removed
Permission Changed
Sensitive Record Viewed
Document Confirmed
Account Recovery
Relationship Revoked
```

---

## R2.18-28 — Parent Portal Has No AI Dependency

**Decision:** LOCKED

Baseline Parent functionality must work without AI:

```text
Academic Summary
Attendance
Schedule
Notifications
Path Visibility
School Communication
Required Actions
```

AI summaries/recommendations remain FUTURE, OPTIONAL, NON-BLOCKING.

---

## R2.18-29 — Parent UI Must Remain Simpler Than Administrative UI

**Decision:** LOCKED

Candidate top-level experience:

```text
Home
Anak
Akademik
Aktivitas / Jadwal
Path
Notifikasi / Pesan
```

Final information architecture remains subject to Design/IA discovery.

---

## R2.18-30 — Parent Portal Product Principle

**Decision:** LOCKED

```text
RELEVANT VISIBILITY
+
ACTIONABLE INFORMATION
+
CONTROLLED PRIVACY
+
MULTI-CHILD SUPPORT
+
LIFECYCLE-AWARE ACCESS
```

Parent Portal is not unrestricted access to everything about the student.

---

## R2.18 Consolidated Result

```text
R2.18-01 Independent Parent Account             → LOCKED
R2.18-02 Multiple Guardians                     → LOCKED
R2.18-03 Cross-Tenant Multi-Child               → LOCKED
R2.18-04 Verified Relationship                  → LOCKED
R2.18-05 Parent Home                            → LOCKED
R2.18-06 Safe Multi-Child Switching             → LOCKED
R2.18-07 Attendance                             → LOCKED
R2.18-08 Learn Summary                          → LOCKED
R2.18-09 Assessment Status Only                 → LOCKED
R2.18-10 Result Release Policy                  → LOCKED
R2.18-11 Track Parent View                      → LOCKED
R2.18-12 Controlled Early Warning               → LOCKED
R2.18-13 Safe Care Information                  → LOCKED
R2.18-14 Parent Actions                         → LOCKED
R2.18-15 Targeted Announcements                 → LOCKED
R2.18-16 Prioritized Notifications              → LOCKED
R2.18-17 Parent ≠ Proctor                       → LOCKED
R2.18-18 Passport Lifecycle Privacy             → LOCKED
R2.18-19 Path Participation                     → LOCKED
R2.18-20 No Silent Goal Override                → LOCKED
R2.18-21 Contextual Opportunity Visibility      → LOCKED
R2.18-22 Scoped Messaging                       → LOCKED
R2.18-23 No Other-Student Access                → LOCKED
R2.18-24 Delegated Guardian Permission          → LOCKED
R2.18-25 Relationship Termination               → LOCKED
R2.18-26 Transfer Continuity                    → LOCKED
R2.18-27 Guardian Audit                         → LOCKED
R2.18-28 AI Future Only                         → LOCKED
R2.18-29 Simple Parent UI                       → LOCKED
R2.18-30 Product Principle                      → LOCKED
```

These decisions supersede conflicting assumptions that a parent/guardian account should have broad unrestricted access to student data.

---

# 27. Path Recovery

## 27.1 Primary Paths

**Status: LOCKED**

```text
Kuliah
Kerja
Bisnis / Wirausaha
```

Additional options:

```text
Beasiswa
Pelatihan
Sertifikasi
Magang
Belum Tahu
```

**Status:** PROVISIONAL.

---

## 27.2 Recommendation Inputs

Potential:

- interests;
- goals;
- competencies;
- Passport;
- achievements;
- academic performance;
- location;
- cost preference;
- readiness assessment.

**Status:** OPEN / PROVISIONAL.

No AI recommendation logic is locked yet.

---


# 27A. RECOVERY-R2.19 Review Outcome — Path / Bridging Engine

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.19  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Path / Bridging Engine direction.

## Locked Product Direction

Path is the official ELLIGBLE **Bridging Engine** connecting:

```text
TRACK
Where am I now?

PASSPORT
What have I proven?

PATH
Where do I want to go?

PARTNER ECOSYSTEM
What opportunities exist?

ACTION PLAN
What should I do next?

OUTCOME
What actually happened?
```

### Core Pathways

```text
HIGHER EDUCATION
CAREER
ENTREPRENEURSHIP
SKILL / TRAINING / CERTIFICATION
```

Students may maintain multiple future plans such as PRIMARY, BACKUP, and ALTERNATIVE.

### Higher-Education Target

The historical LPTPAT `Target PTN` concept is retained and expanded into:

```text
Target Institution
Target Study Program
Admission Route
Target Entry Year
Priority
Status
```

Possible destinations include PTN, PTS, polytechnics, relevant government academies, overseas higher education, and other valid routes.

Destination/program/route/deadline data must be configurable and not hardcoded.

### Readiness

Path uses explainable readiness rather than unsupported admission/employment prediction.

Candidate dimensions:

```text
Academic Readiness
Portfolio Readiness
Requirement Completion
Preparation Progress
```

Missing historical data must not be interpreted as poor performance.

### Action Plan

Targets must become actionable:

```text
TODO
IN_PROGRESS
COMPLETED
MISSED
NOT_APPLICABLE
```

with target dates, completion dates, sources, and evidence where relevant.

### Domain Inputs

Path may consume authorized data from:

```text
Track
Passport
Student Interests
Opportunity Requirements
```

Private Care/BK notes are excluded.

### Opportunity Matching

Baseline matching is deterministic and rule-based:

```text
Eligibility
Interest Tags
Location
Grade
Program
Deadline
Required Competencies
Student Opt-In
```

Candidate states:

```text
RELEVANT
ELIGIBLE
NOT_YET_ELIGIBLE
UNKNOWN
```

Relevance does not equal eligibility.

### Application Flow

Candidate lifecycle:

```text
DISCOVERED
SAVED
PREPARING
APPLIED
UNDER_REVIEW
SHORTLISTED
ACCEPTED
REJECTED
WITHDRAWN
```

Applying requires explicit student action/consent.

When applying:

```text
Current Passport
↓
Required Data Preview
↓
Student Consent
↓
Application Snapshot
↓
Partner
```

### Verified Connection & Outcome Tracking

A verified connection is created only from a real relationship/outcome such as:

```text
Scholarship Accepted
Recruitment Accepted
Internship Accepted
Mentorship Mutually Accepted
```

Outcome tracking may include:

```text
Applied → Accepted → Enrolled
Applied → Accepted → Employed
Training → Certified
```

This supports ELLIGBLE's long-term Bridging/impact measurement.

### Parent / School Support

Parents may view selected Path information according to policy/permission and may suggest, but not silently overwrite, student-owned goals.

Authorized school staff such as homeroom teachers, counselors, or academic/career advisors may support Path according to assignment scope.

### Alumni Continuity

Path continues after graduation because many transitions occur in the alumni phase.

### Deadline / Opportunity Freshness

Path supports:

```text
Application Opening
Application Closing
Document Deadline
Exam/Test Date
Interview
Announcement
Enrollment
```

Opportunity data should retain:

```text
Source
Last Verified
Opening Date
Closing Date
Status
Provider / Partner
```

Expired opportunities move through:

```text
ACTIVE
↓
CLOSED
↓
ARCHIVED
```

without destroying historical applications.

### Sponsored Transparency

Any future sponsored opportunity must be clearly labeled and must not secretly manipulate relevance/readiness ranking.

### AI Policy

All AI Path features remain:

```text
FUTURE
OPTIONAL
NON-BLOCKING
```

Baseline Path uses rules, filters, requirements, thresholds, structured matching, and deterministic calculations.

## R2.19 Consolidated Result

```text
Path as Bridging Engine                     → LOCKED
Multiple Future Plans                       → LOCKED
Higher-Education Target / Target PTN        → LOCKED
Configurable Destination Data               → LOCKED
Explainable Readiness                       → LOCKED
Missing-History Safe Calculation            → LOCKED
Editable Interests                          → LOCKED
Action Plan                                 → LOCKED
Track + Passport Inputs                     → LOCKED
Scholarship Path                            → LOCKED
Career Path                                 → LOCKED
Entrepreneurship Path                       → LOCKED
Skill / Certification Path                  → LOCKED
Rule-Based Opportunity Matching             → LOCKED
Eligibility ≠ Relevance                     → LOCKED
Structured Requirements                     → LOCKED
Student-Controlled Application              → LOCKED
Application Passport Snapshot               → LOCKED
Verified Connection                         → LOCKED
Outcome Tracking                            → LOCKED
No Guarantee Language                       → LOCKED
Controlled Parent / Staff Support           → LOCKED
Alumni Continuity                           → LOCKED
Goal History                                → LOCKED
Deadline Engine                             → LOCKED
Opportunity Expiry / Freshness              → LOCKED
Saved Opportunity                           → LOCKED
Opportunity Comparison                      → LOCKED
Sponsored Transparency                      → LOCKED
AI                                          → FUTURE ONLY
```

These decisions supersede narrower assumptions that Path is merely a Target PTN feature.

---

# 28. Partner / Merchant Recovery

Candidate Partner Portal:

```text
Registration
Verification
Organization Profile
Opportunity Management
Campaign
Lead / Referral
Messaging
Analytics
Billing
Compliance
Complaint Management
```

**Status:** PROVISIONAL.

Candidate opportunities:

```text
University / Study Program
Scholarship
Job
Internship
Training
Certification
Business Incubator
Mentorship
Merchant Product / Service
Event
```

---


# 28A. RECOVERY-R2.20 Review Outcome — Partner & Opportunity Ecosystem

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.20  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Partner & Opportunity Ecosystem direction.

---

## R2.20-01 — Partner Is Not a School Academic Tenant

**Decision:** LOCKED

Partner organizations belong to the Partner & Opportunity Ecosystem, not to the school academic tenant model.

Candidate partner categories include:

```text
Higher Education
Company / Recruiter / HR
Scholarship Provider
Training Provider
Certification Provider
Incubator / Accelerator
Mentor Organization
Youth / Development Community
Relevant Merchant / Service Provider
Other Approved Opportunity Provider
```

---

## R2.20-02 — Partner Is an Organization With Memberships

**Decision:** LOCKED

Preferred model:

```text
PARTNER ORGANIZATION
↓
Partner Membership
↓
Partner Staff
↓
Assignments / Capabilities
```

One organization may contain multiple authorized staff.

---

## R2.20-03 — Verification Before Sensitive Capability

**Decision:** LOCKED

Candidate partner lifecycle:

```text
REGISTERED
↓
PENDING_VERIFICATION
↓
VERIFIED
↓
ACTIVE
```

Additional states:

```text
SUSPENDED
REJECTED
REVOKED
```

Sensitive capabilities must not be granted solely because an organization created an account.

---

## R2.20-04 — Partner Verification Level Is Extensible

**Decision:** LOCKED

Candidate trust levels:

```text
BASIC_VERIFIED
ORGANIZATION_VERIFIED
HIGH_TRUST_VERIFIED
```

Final names/criteria remain subject to dedicated Trust & Safety discovery.

---

## R2.20-05 — Partner Profile Has Provenance

**Decision:** LOCKED

Candidate organization profile data:

```text
Legal / Organization Name
Organization Type
Description
Website
Contact
Location
Verification Status
Verification Date
Opportunity History
Trust / Enforcement Status
```

Verification and important changes must remain auditable.

---

## R2.20-06 — Partner Staff Uses Assignments, Not Role Explosion

**Decision:** LOCKED

Examples:

```text
Partner Admin
Recruiter
HR
Scholarship Officer
Admission Officer
Training Officer
Mentor
Program Manager
```

These remain assignments/capability bundles beneath `PARTNER_STAFF`.

---

## R2.20-07 — Opportunity Creation Follows Capability

**Decision:** LOCKED

Partner staff may create only opportunity types allowed by organization type, assignment, and verification state.

---

## R2.20-08 — Structured Opportunity Types

**Decision:** LOCKED

Initial candidate types:

```text
UNIVERSITY / STUDY PROGRAM
SCHOLARSHIP
JOB
INTERNSHIP
TRAINING
CERTIFICATION
MENTORSHIP
ENTREPRENEURSHIP PROGRAM
INCUBATION / ACCELERATION
COMPETITION
EVENT / DEVELOPMENT PROGRAM
```

The model remains extensible.

---

## R2.20-09 — Opportunity Is Structured Data, Not Merely a Poster

**Decision:** LOCKED

Candidate fields:

```text
Title
Type
Provider
Description
Requirements
Location
Delivery Mode
Opening Date
Closing Date
Capacity where relevant
Application Process
Required Documents / Data
Status
Source
Last Verified
```

---

## R2.20-10 — Opportunity Lifecycle

**Decision:** LOCKED

Candidate lifecycle:

```text
DRAFT
↓
SUBMITTED_FOR_REVIEW
↓
PUBLISHED
↓
CLOSED
↓
ARCHIVED
```

Enforcement states may include:

```text
SUSPENDED
REMOVED
```

---

## R2.20-11 — Publishing May Require Moderation

**Decision:** LOCKED

New/sensitive partners may require:

```text
Partner Creates Opportunity
↓
ELLIGBLE Verification / Moderation
↓
Publish
```

Trusted partners may later receive streamlined approval according to policy.

---

## R2.20-12 — Requirements Should Be Machine-Readable

**Decision:** LOCKED

Candidate structured requirements:

```text
Grade
Education Level
Study Program
Academic Criteria
Competency
Certificate
Portfolio
Required Documents
Location
Deadline
Other Approved Criteria
```

This supports deterministic eligibility checks in Path.

---

## R2.20-13 — Sensitive / Discriminatory Requirements Require Control

**Decision:** LOCKED

Partners must not freely publish inappropriate, irrelevant, discriminatory, or policy-violating requirements.

Validation/moderation is required where appropriate.

---

## R2.20-14 — Opportunity Discovery Is Student-Centric

**Decision:** LOCKED

Opportunity discovery may use:

```text
Eligibility
Interest
Path
Grade
Location
Deadline
Relevant Competency
Explicit Preferences
```

The model does not begin by exposing the entire student population to partners.

---

## R2.20-15 — No Unrestricted Student Search

**Decision:** LOCKED

Prohibited default capabilities:

```text
Download Entire Student Database
Browse All Grades
Browse All Passport Records
Search Every Student Without Opt-In
```

---

## R2.20-16 — Talent Discovery Requires Student Opt-In

**Decision:** LOCKED

Candidate flow:

```text
Student Enables Discoverability
↓
Limited Searchable Talent Profile
↓
Partner Discovers Candidate
↓
Partner Requests Contact / Sends Invitation
↓
Student Accepts / Rejects
```

Discoverability does not expose the full Passport.

---

## R2.20-17 — Invitation Does Not Equal Data Sharing

**Decision:** LOCKED

Partner invitation requires student review.

Passport/data sharing occurs only through a separate authorized consent flow.

---

## R2.20-18 — Application Is Student-Initiated and Consent-Based

**Decision:** LOCKED

Preferred flow:

```text
Opportunity
↓
Student Apply
↓
Required Data Preview
↓
Consent
↓
Passport Snapshot
↓
Partner Candidate Pipeline
```

---

## R2.20-19 — Partner Candidate Pipeline

**Decision:** LOCKED

Candidate states:

```text
RECEIVED
UNDER_REVIEW
SHORTLISTED
INTERVIEW / SELECTION
OFFERED
ACCEPTED
REJECTED
WITHDRAWN
```

Specific opportunity types may extend or adapt the state machine.

---

## R2.20-20 — Partner Cannot Arbitrarily Edit Student Passport

**Decision:** LOCKED

Partners may only perform approved actions such as:

```text
Verify Selected External Outcome / Record
Issue Approved Credential / Certificate
Submit Outcome
```

through explicit workflows.

They cannot freely alter school-issued grades or other Passport records.

---

## R2.20-21 — Partner Can Act as Verifier / Issuer

**Decision:** LOCKED

Example:

```text
Training Completed
↓
Provider Verifies
↓
Certificate Issued
↓
Passport Record
Verification = External-Verified
```

Issuer identity and audit must remain visible.

---

## R2.20-22 — Verified Connection Requires a Real Outcome / Relationship

**Decision:** LOCKED

Examples:

```text
Internship Accepted
Scholarship Accepted
Recruitment Accepted
Mentorship Mutually Accepted
```

Connection remains scoped and does not grant permanent unrestricted Passport access.

---

## R2.20-23 — Structured Outcome Reporting

**Decision:** LOCKED

Candidate outcomes:

```text
Accepted
Enrolled
Employed
Internship Started
Training Completed
Certified
Program Completed
```

---

## R2.20-24 — Outcome Disagreement Is Supported

**Decision:** LOCKED

Partner-submitted outcomes are not always final truth.

Important outcomes may require:

```text
Partner Submitted
↓
Student Confirmed
```

or controlled review where appropriate.

---

## R2.20-25 — Partner Performance Is Explainable

**Decision:** LOCKED

Candidate monitoring dimensions:

```text
Opportunity Validity
Response Rate
Complaint Rate
Fake Opportunity Reports
Completion / Outcome History
Policy Violations
```

A single opaque partner score is not the preferred default.

---

## R2.20-26 — Abuse Reporting Is Mandatory

**Decision:** LOCKED

Students/schools may report:

```text
Fake Opportunity
Misleading Requirement
Data Misuse
Harassment
Scam
Inappropriate Content
Recruitment Abuse
```

Candidate flow:

```text
Report
↓
Trust & Safety Case
↓
Investigation
↓
Action
↓
Audit
```

---

## R2.20-27 — Partner Suspension Preserves Historical Records

**Decision:** LOCKED

```text
ACTIVE
↓
SUSPENDED / REVOKED
```

must not destroy legitimate historical:

```text
Applications
Outcomes
Evidence
Connections
Audit
```

---

## R2.20-28 — Commercial / Merchant Offers Are Distinct

**Decision:** LOCKED

```text
Commercial Offer
≠
Education / Career Opportunity
```

Sponsored/commercial content must be clearly labeled.

---

## R2.20-29 — Partner Cannot Buy Relevance / Student Ranking

**Decision:** LOCKED

Payment must not secretly cause an irrelevant opportunity to appear as “best match” or “most suitable.”

Sponsorship and relevance are separate concepts.

---

## R2.20-30 — Partner Analytics Is Scope-Limited

**Decision:** LOCKED

Partner analytics may include:

```text
Applicants
Pipeline Conversion
Aggregate Opportunity Views
Accepted Outcomes
```

only for data the partner is authorized to access.

Partners do not receive analytics for the entire school/student population.

---

## R2.20-31 — School May See Aggregate Partner Outcomes

**Decision:** LOCKED

Where privacy/consent permits, schools may see aggregate outcomes such as:

```text
Alumni Accepted by Company X
Students Receiving Scholarship Y
Students Entering University Z
```

---

## R2.20-32 — Partner Domain Is Fault-Isolated From Assessment

**Decision:** LOCKED

Partner outages must not affect:

```text
CBT
Autosave
Submission
Proctoring
Academic Core
```

---

## R2.20-33 — Opportunity Freshness

**Decision:** LOCKED

Expired opportunity records must not remain presented as active.

Partners may be required to reconfirm/update opportunity information.

---

## R2.20-34 — Verification Override Is High-Risk

**Decision:** LOCKED

Internal actions such as:

```text
Approve
Reject
Suspend
Revoke
Override Verification
```

must be audited and may require maker-checker according to risk.

---

## R2.20-35 — Partner Access Is Revocable

**Decision:** LOCKED

When consent/application/relationship access ends:

```text
Access Expires / Revokes
```

Historical application snapshots needed for audit may remain retained.

---

## R2.20-36 — Candidate Export Is Restricted

**Decision:** LOCKED

Any permitted export should use:

```text
Authorized Applicants Only
Limited Fields
Purpose / Reason
Audit
Watermark / Reference where appropriate
```

No broad database dump.

---

## R2.20-37 — Cross-Partner Isolation

**Decision:** LOCKED

Partner A cannot access Partner B's:

```text
Applicants
Pipeline
Private Organization Data
Outcomes
Internal Team Data
```

without explicit authorized organizational relationship.

---

## R2.20-38 — Partner Organization Groups Are Possible

**Decision:** LOCKED

A holding/group may contain multiple subsidiaries or partner units.

Cross-organization access remains explicit, scoped, and audited.

---

## R2.20-39 — Partner Portal Is a Productivity Workspace

**Decision:** LOCKED

Candidate top-level areas:

```text
Dashboard
Opportunities
Applicants
Connections
Outcomes
Organization
Team
Verification
Notifications
```

Final IA remains subject to dedicated Design/IA discovery.

---

## R2.20-40 — AI Partner Features Are FUTURE Only

**Decision:** LOCKED — FUTURE ONLY

Potential future features:

```text
AI Candidate Matching
AI Applicant Summarization
AI Opportunity Writing
AI Fraud Detection
```

remain:

```text
FUTURE
OPTIONAL
NON-BLOCKING
```

Baseline Partner functionality must operate without paid AI services.

---

## R2.20 Consolidated Result

```text
R2.20-01 Partner ≠ School Tenant                    → LOCKED
R2.20-02 Partner Organization Model                 → LOCKED
R2.20-03 Verification Lifecycle                     → LOCKED
R2.20-04 Verification Levels                        → LOCKED
R2.20-05 Profile Provenance                         → LOCKED
R2.20-06 Staff Assignments                          → LOCKED
R2.20-07 Capability-Based Publishing                → LOCKED
R2.20-08 Opportunity Types                          → LOCKED
R2.20-09 Structured Opportunity                     → LOCKED
R2.20-10 Opportunity Lifecycle                      → LOCKED
R2.20-11 Moderation                                 → LOCKED
R2.20-12 Machine-Readable Requirements              → LOCKED
R2.20-13 Requirement Policy Control                 → LOCKED
R2.20-14 Student-Centric Discovery                  → LOCKED
R2.20-15 No Unrestricted Student Search             → LOCKED
R2.20-16 Opt-In Talent Discovery                    → LOCKED
R2.20-17 Invitation ≠ Sharing                       → LOCKED
R2.20-18 Consent-Based Application                  → LOCKED
R2.20-19 Candidate Pipeline                         → LOCKED
R2.20-20 No Arbitrary Passport Editing              → LOCKED
R2.20-21 Partner as Verifier / Issuer               → LOCKED
R2.20-22 Verified Connection                        → LOCKED
R2.20-23 Structured Outcomes                        → LOCKED
R2.20-24 Outcome Disagreement                       → LOCKED
R2.20-25 Partner Performance                        → LOCKED
R2.20-26 Abuse Reporting                            → LOCKED
R2.20-27 Suspension Preserves History               → LOCKED
R2.20-28 Merchant Separation                        → LOCKED
R2.20-29 No Paid Relevance Manipulation             → LOCKED
R2.20-30 Scoped Analytics                           → LOCKED
R2.20-31 School Aggregate Outcomes                  → LOCKED
R2.20-32 Fault Isolation                            → LOCKED
R2.20-33 Opportunity Freshness                      → LOCKED
R2.20-34 High-Risk Verification Override            → LOCKED
R2.20-35 Revocable Access                           → LOCKED
R2.20-36 Restricted Export                          → LOCKED
R2.20-37 Cross-Partner Isolation                    → LOCKED
R2.20-38 Organization Group                         → LOCKED
R2.20-39 Partner Workspace                          → LOCKED
R2.20-40 AI Future Only                             → LOCKED — FUTURE
```

These decisions supersede conflicting assumptions that partner organizations should receive broad student access or behave as academic school tenants.

---

# 29. Alumni Recovery

Candidate:

- automatic/verified student-to-alumni transition;
- Passport continuity;
- current status update;
- college/work/business status;
- alumni network;
- mentorship;
- opportunity sharing;
- tracer study;
- school contribution;
- graduate impact analytics.

**Status:** LOCKED concept, implementation FUTURE/PROVISIONAL.

---


# 29A. RECOVERY-R2.21 Review Outcome — Alumni, Verified Connection & Outcome / Impact

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.21  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Alumni, Verified Connection, Outcome Tracking, and Impact direction.

---

## R2.21-01 — Alumni Is Not a New Account

**Decision:** LOCKED

Graduation preserves:

```text
Same Person ID
Same User Account
Same Passport
Same Path
```

Student lifecycle transitions to alumni without creating a duplicate identity.

---

## R2.21-02 — Alumni Is a Lifecycle State + Capability Context

**Decision:** LOCKED

Preferred model:

```text
Global Identity
↓
Historical School Membership
↓
ALUMNI Lifecycle
↓
Optional New Assignments / Contexts
```

Examples of future additional contexts:

```text
Mentor
Partner Staff
Recruiter
Speaker
Parent
Teacher
```

---

## R2.21-03 — Formal Graduation Transition

**Decision:** LOCKED

Graduation must use an explicit lifecycle transition:

```text
ACTIVE STUDENT
↓
Graduation Process
↓
GRADUATED
↓
ALUMNI
```

with relevant metadata:

```text
Graduation Date
Academic Year
School
Program
Status
Audit
```

---

## R2.21-04 — Passport Continues After Graduation

**Decision:** LOCKED

Passport may continue evolving through:

```text
Higher Education
Internship
Certification
Employment
Entrepreneurship
Professional Achievement
```

New records still require provenance and verification.

---

## R2.21-05 — School-Owned Records Preserve School Provenance

**Decision:** LOCKED

Historical school-issued records remain attributable to the school after graduation.

Alumni cannot convert verified school records into self-declared records.

---

## R2.21-06 — Alumni May Add New Records

**Decision:** LOCKED

Examples:

```text
Higher Education
Internship
Employment
Business
Certification
Project
Achievement
```

These may begin as `SELF-DECLARED` until verified.

---

## R2.21-07 — Path Continues After Graduation

**Decision:** LOCKED

Path remains active for real post-school transitions such as:

```text
Target University → Accepted → Enrolled
Target Career → Applied → Accepted → Employed
Entrepreneurship → Business Started
```

---

## R2.21-08 — Goal Is Different From Outcome

**Decision:** LOCKED

```text
GOAL
= intended destination

OUTCOME
= what actually happened
```

Both are preserved as distinct concepts.

---

## R2.21-09 — Structured Outcome Types

**Decision:** LOCKED

Candidate outcome types include:

```text
HIGHER_EDUCATION_ENROLLED
EMPLOYED
INTERNSHIP_STARTED
BUSINESS_STARTED
TRAINING_STARTED
CERTIFIED
SCHOLARSHIP_RECEIVED
PROGRAM_COMPLETED
OTHER_VERIFIED_TRANSITION
```

Final naming may be simplified later.

---

## R2.21-10 — Outcome Has Provenance

**Decision:** LOCKED

Important outcome records should retain:

```text
Source
Verification
Confirmation
Effective Date
Issuer / Partner
Audit
```

---

## R2.21-11 — Multiple Outcome Sources

**Decision:** LOCKED

Candidate sources:

```text
Alumni Self-Report
Partner Confirmation
Higher Education Partner
Training Provider
School Follow-Up
Official Document
```

Verification level differentiates confidence.

---

## R2.21-12 — Self-Reported Outcome Is Not Automatically Verified

**Decision:** LOCKED

Self-reported outcomes may begin as:

```text
SELF-DECLARED
```

until verified.

---

## R2.21-13 — Important Partner-Submitted Outcomes May Require Alumni Confirmation

**Decision:** LOCKED

Candidate flow:

```text
Partner Submits Outcome
↓
Alumni Confirms
```

or controlled review where appropriate.

---

## R2.21-14 — Verified Connection Exists Only While Relationship Is Real

**Decision:** LOCKED

Connection may transition through lifecycle rather than remain permanently active.

---

## R2.21-15 — Connection Lifecycle

**Decision:** LOCKED

Candidate states:

```text
PENDING
VERIFIED
ACTIVE
COMPLETED
CANCELLED
EXPIRED
```

---

## R2.21-16 — Connection Permissions Are Scoped

**Decision:** LOCKED

A verified relationship does not grant unrestricted Passport access.

Allowed capabilities may include:

```text
Communication
Outcome Confirmation
Credential Issuance
Program Follow-Up
```

according to scope.

---

## R2.21-17 — Alumni Can Opt In as Mentor

**Decision:** LOCKED

Candidate flow:

```text
Alumni
↓
Opt-In as Mentor
↓
Verification
↓
Mentor Assignment
↓
Scoped Student Interaction
```

---

## R2.21-18 — Alumni Mentoring Is Not a Free Social Network

**Decision:** LOCKED

Mentoring should be based on:

```text
Program
Assignment
Interest
Request
Matching Rules
School Approval where required
```

not follower/friend mechanics.

---

## R2.21-19 — Alumni Contribution to School

**Decision:** LOCKED

Candidate contribution modes:

```text
Mentoring
Career Talk
Guest Speaker
Internship Opportunity
Scholarship
Project Collaboration
Future Donation / Support if appropriate
```

Each capability remains separately authorized.

---

## R2.21-20 — Alumni School Relationship Is Historical

**Decision:** LOCKED

Alumni may retain:

```text
Alumni of School X
Graduated Year
Program
```

but no longer receive active student rights to:

```text
Current Class
Student Assessment
Current Learn Classroom
Student-Only Operational Data
```

---

## R2.21-21 — Alumni School Content Is Scoped

**Decision:** LOCKED

School may provide:

```text
Alumni Announcements
Alumni Events
Career Opportunities
Mentoring Programs
```

without reopening full School OS access.

---

## R2.21-22 — Alumni Directory Is Opt-In

**Decision:** LOCKED

Any future alumni directory must be:

```text
OPT-IN
Privacy-Controlled
Limited Fields
```

---

## R2.21-23 — Alumni Cannot Browse Student Passports

**Decision:** LOCKED

Mentor/alumni access to students remains assignment/consent scoped.

---

## R2.21-24 — Outcome Follow-Up May Be Periodic

**Decision:** LOCKED

Schools/platform may request alumni outcome updates at intervals such as:

```text
6 months
12 months
24 months
```

subject to anti-spam and privacy rules.

---

## R2.21-25 — UNKNOWN Is a Valid Outcome State

**Decision:** LOCKED

No response does not equal unemployment.

```text
UNKNOWN
≠
UNEMPLOYED
```

This is essential for unbiased impact analytics.

---

## R2.21-26 — Employment / Activity Status Must Support Real-Life Complexity

**Decision:** LOCKED

Candidate states:

```text
EMPLOYED
SELF_EMPLOYED
ENTREPRENEUR
STUDYING
TRAINING
SEEKING_OPPORTUNITY
MULTIPLE_ACTIVITIES
UNKNOWN
```

---

## R2.21-27 — Multiple Concurrent Outcomes Are Supported

**Decision:** LOCKED

A person may simultaneously be:

```text
Higher Education Enrolled
+
Part-Time Employed
+
Business Started
```

The model must not force one exclusive life state.

---

## R2.21-28 — Impact Analytics Must Show Data Coverage

**Decision:** LOCKED

Example:

```text
Cohort: 300
Known / Verified or Responded: 240
Unknown: 60
```

Outcome percentages must clearly state their denominator and coverage.

---

## R2.21-29 — School Impact Dashboard

**Decision:** LOCKED

Candidate aggregates:

```text
Graduates
Known Outcomes
Unknown Outcomes
Higher Education Placement
Employment
Entrepreneurship
Certification
Scholarship
Time-to-Outcome
```

without unnecessary exposure of individual details.

---

## R2.21-30 — Platform Impact Dashboard

**Decision:** LOCKED

Platform-level aggregates may include:

```text
Total Graduates
Transition Outcomes
Opportunity Conversion
Scholarship Outcomes
Employment Outcomes
Higher Education Placement
Regional Trends
```

subject to privacy/aggregation requirements.

---

## R2.21-31 — Impact Claims Must Be Evidence-Based

**Decision:** LOCKED

ELLIGBLE may measure:

```text
Readiness
Applications
Placement
Employment Outcome
Transition Time
```

but causal claims such as reducing unemployment by a specific amount require a defensible evaluation methodology.

Correlation alone is insufficient.

---

## R2.21-32 — Outcome Changes Are Historical, Not Overwritten

**Decision:** LOCKED

Example:

```text
Employment A
Start → End

Employment B
Start → Active
```

Historical employment/outcome records are preserved.

---

## R2.21-33 — Verified Employment Can Enter Passport

**Decision:** LOCKED

Verified employment, internship, and certification may become Passport records.

Sensitive HR data such as:

```text
Salary
Private HR Notes
Rejection Reasons
```

is excluded by default.

---

## R2.21-34 — Rejection Is Private History, Not Public Stigma

**Decision:** LOCKED

Application rejection may remain in private application history but must not become public profiling or be exposed to unrelated partners.

---

## R2.21-35 — School Access to Alumni Employment Detail Is Purpose-Limited

**Decision:** LOCKED

Schools may see appropriately authorized outcome information but do not receive unrestricted detailed alumni career data.

---

## R2.21-36 — Alumni Can Revoke Discoverability

**Decision:** LOCKED

Opt-in discoverability can be disabled.

Historical authorized applications/connections follow retention policy.

---

## R2.21-37 — Alumni Retention Rules Differ From Active Student Rules

**Decision:** LOCKED

Separate retention policy may be required for:

```text
School Records
Passport
Application Snapshots
Outcomes
Connections
Audit
```

Final legal periods remain subject to later legal/privacy discovery.

---

## R2.21-38 — Identity Remains Portable

**Decision:** LOCKED

If alumni later becomes:

```text
University Student
Partner Staff
Mentor
Parent
Teacher
```

ELLIGBLE still uses one global person identity.

---

## R2.21-39 — AI for Alumni / Impact Is FUTURE Only

**Decision:** LOCKED — FUTURE ONLY

Baseline uses:

```text
Outcome Collection
Rule-Based Follow-Up
Structured Analytics
Cohort Calculation
Deterministic Aggregation
```

No AI dependency is required.

---

## R2.21-40 — End-to-End Lifecycle Principle

**Decision:** LOCKED

```text
STUDENT
↓
LEARN
↓
ASSESS
↓
TRACK
↓
PASSPORT
↓
PATH
↓
OPPORTUNITY
↓
VERIFIED CONNECTION
↓
OUTCOME
↓
ALUMNI
↓
NEW OPPORTUNITIES / CONTRIBUTION
```

This establishes ELLIGBLE as an end-to-end education-to-future platform rather than a system that ends at graduation.

---

## R2.21 Consolidated Result

```text
R2.21-01 Same Identity After Graduation          → LOCKED
R2.21-02 Alumni Lifecycle Model                  → LOCKED
R2.21-03 Formal Graduation Transition            → LOCKED
R2.21-04 Passport Continuity                     → LOCKED
R2.21-05 School Provenance                       → LOCKED
R2.21-06 New Alumni Records                      → LOCKED
R2.21-07 Path Continuity                         → LOCKED
R2.21-08 Goal ≠ Outcome                          → LOCKED
R2.21-09 Structured Outcomes                     → LOCKED
R2.21-10 Outcome Provenance                      → LOCKED
R2.21-11 Multiple Outcome Sources                → LOCKED
R2.21-12 Self-Report Verification                → LOCKED
R2.21-13 Partner Outcome Confirmation            → LOCKED
R2.21-14 Real Relationship Connection            → LOCKED
R2.21-15 Connection Lifecycle                    → LOCKED
R2.21-16 Scoped Connection Permission            → LOCKED
R2.21-17 Alumni Mentor Opt-In                    → LOCKED
R2.21-18 Mentoring ≠ Social Network              → LOCKED
R2.21-19 Alumni Contribution                     → LOCKED
R2.21-20 Historical School Relationship          → LOCKED
R2.21-21 Scoped Alumni Content                   → LOCKED
R2.21-22 Opt-In Alumni Directory                 → LOCKED
R2.21-23 No Student Passport Browsing            → LOCKED
R2.21-24 Periodic Outcome Follow-Up              → LOCKED
R2.21-25 Unknown Outcome Is Valid                → LOCKED
R2.21-26 Complex Activity Status                 → LOCKED
R2.21-27 Concurrent Outcomes                     → LOCKED
R2.21-28 Coverage-Aware Impact Analytics         → LOCKED
R2.21-29 School Impact Dashboard                 → LOCKED
R2.21-30 Platform Impact Dashboard               → LOCKED
R2.21-31 Evidence-Based Impact Claims            → LOCKED
R2.21-32 Historical Outcome Changes              → LOCKED
R2.21-33 Verified Employment → Passport          → LOCKED
R2.21-34 Rejection Privacy                       → LOCKED
R2.21-35 Purpose-Limited School Access           → LOCKED
R2.21-36 Revoke Discoverability                  → LOCKED
R2.21-37 Alumni Retention Policy                 → LOCKED
R2.21-38 Portable Identity                       → LOCKED
R2.21-39 AI Future Only                          → LOCKED — FUTURE
R2.21-40 End-to-End Lifecycle                    → LOCKED
```

These decisions supersede conflicting assumptions that ELLIGBLE should end at student graduation or treat alumni as a separate identity.

---

# 30. Insight Recovery

Candidate dashboards:

```text
Platform Owner
School Admin
Principal
Teacher
Proctor
Counselor
Student
Parent
Partner
```

Potential:

- school health;
- academic trend;
- assessment performance;
- engagement;
- risk;
- usage;
- partner conversion;
- tenant health;
- export.

**Status:** PROVISIONAL.

---


# 30A. RECOVERY-R2.22 Review Outcome — Notifications, Messaging & Search

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.22  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete shared Notifications, Messaging, and Search direction.

---

## R2.22-01 — Global Notification Center

**Decision:** LOCKED

Shared notification infrastructure may be used by:

```text
Learn
Assess
Track
Care
Parent
Path
Partner
Alumni
Security
Platform Operations
```

Every notification must preserve its source/domain context.

---

## R2.22-02 — Four Notification Priority Levels

**Decision:** LOCKED

```text
CRITICAL
IMPORTANT
NORMAL
INFO
```

`CRITICAL` is reserved for genuinely urgent operational/security situations.

---

## R2.22-03 — Notifications Must Be Actionable

**Decision:** LOCKED

Notifications should deep-link users into the relevant authorized workflow where appropriate.

Examples:

```text
Assignment Due
→ Open Assignment

Exam Starts Soon
→ Enter Exam

Application Status Changed
→ View Application
```

---

## R2.22-04 — Multi-Channel Delivery

**Decision:** LOCKED

Baseline web-first channels may include:

```text
In-App
Web Push where supported
Email where appropriate
```

Future native channels:

```text
Android Push
iOS Push
```

Not all messages are delivered over all channels.

---

## R2.22-05 — User Notification Preferences

**Decision:** LOCKED

Users may control non-critical categories where safe.

Security/operational notifications that are essential to safety or integrity may remain mandatory.

---

## R2.22-06 — Notification Deduplication / Coalescing

**Decision:** LOCKED

Repeated events should not create avoidable spam.

The architecture should support deduplication/coalescing for similar events.

---

## R2.22-07 — Reminder Engine Is Separate From Notification UI

**Decision:** LOCKED

Scheduling/reminder logic for:

```text
Path deadlines
Learn deadlines
Care appointments
Exam schedules
Other timed workflows
```

belongs to a reminder/scheduler capability that emits notifications.

---

## R2.22-08 — Read/Unread Does Not Change Domain State

**Decision:** LOCKED

Reading a notification does not mean:

```text
Assignment Completed
Application Completed
Care Follow-Up Completed
Exam Completed
```

Workflow truth remains in the originating domain.

---

## R2.22-09 — Notification Retention Is Separate From Source Records

**Decision:** LOCKED

Old notification records may be archived/deleted according to policy without deleting the underlying business/domain records.

---

## R2.22-10 — Exam Notifications Are Fault-Isolated

**Decision:** LOCKED

Notification failure must not block:

```text
Exam Join
Autosave
Answer Persistence
Submission
```

---

## R2.22-11 — Messaging Is Not Free Social Chat

**Decision:** LOCKED

Messaging is allowed only through valid relationships/context.

Examples:

```text
Teacher ↔ Student in academic context
Parent ↔ Authorized School Staff
Counselor ↔ Student in Care
Mentor ↔ Student in assignment
Partner ↔ Applicant / Verified Connection
```

---

## R2.22-12 — Conversations Have Explicit Context

**Decision:** LOCKED

Candidate context types:

```text
CLASS
CARE
APPLICATION
MENTORSHIP
SCHOOL_SUPPORT
PARTNER_CONNECTION
OTHER_APPROVED_CONTEXT
```

Conversation context drives authorization.

---

## R2.22-13 — Messaging Capability May End With Context

**Decision:** LOCKED

When a relationship/workflow ends, conversation may become:

```text
READ_ONLY
ARCHIVED
CLOSED
```

according to policy.

---

## R2.22-14 — Blocking / Reporting for Abuse

**Decision:** LOCKED

Users must have an abuse-report path for harassment/spam/inappropriate messaging.

Trust & Safety may investigate according to policy.

---

## R2.22-15 — Care Messaging Is More Private

**Decision:** LOCKED

Care messages inherit Care's strict access controls and must not become ordinary operator-visible school chat.

---

## R2.22-16 — Assessment Messaging Is Restricted

**Decision:** LOCKED

During active exams, permitted communication may include:

```text
Proctor → Student Warning / Instruction
```

Students do not receive unrestricted peer chat during exam runtime.

---

## R2.22-17 — Messaging Attachments Are Policy-Controlled

**Decision:** LOCKED

Attachment handling may consider:

```text
File Type
File Size
Security Validation
Permission
Retention
```

---

## R2.22-18 — AI Chat Is FUTURE Only

**Decision:** LOCKED — FUTURE ONLY

Any AI assistant/chatbot remains:

```text
FUTURE
OPTIONAL
NON-BLOCKING
```

Baseline messaging is human-to-human/system-to-user.

---

## R2.22-19 — Global Search Is Permission-Aware

**Decision:** LOCKED

```text
Search Index
≠
Authorization
```

Search may discover content only when the current user is authorized.

---

## R2.22-20 — Search Results Are Context-Aware

**Decision:** LOCKED

Search output depends on:

```text
Active Context
Tenant
Membership
Assignment
Permission
Resource Scope
```

---

## R2.22-21 — Search Results Show Resource Type

**Decision:** LOCKED

Example:

```text
[Materi] Kelangkaan
[Tugas] Analisis Kelangkaan
[Opportunity] Beasiswa X
[Student] Budi Santoso
```

---

## R2.22-22 — Sensitive Care Content Must Not Leak Through Search

**Decision:** LOCKED

Unauthorized users must not learn that a Care case exists through:

```text
Autocomplete
Search Result
Result Count
Snippet
Index Metadata
```

---

## R2.22-23 — Partner Search Uses Opt-In Talent Index

**Decision:** LOCKED

Partners cannot use global search to enumerate all students.

Talent Discovery uses a restricted searchable dataset containing only approved opt-in fields/users.

---

## R2.22-24 — Global Search Is Disabled in Active Student Exam Runtime

**Decision:** LOCKED

Student exam runtime remains distraction-free and cannot expose general platform search.

Teacher Question Bank/search outside live student runtime remains permitted according to role.

---

## R2.22-25 — Search Index Is Derived Data

**Decision:** LOCKED

Canonical domain/database data remains the source of truth.

Search index may be rebuilt without losing canonical records.

---

## R2.22-26 — Search Updates May Be Asynchronous

**Decision:** LOCKED

Normal index updates may occur asynchronously.

Security-sensitive revocation/deletion requires sufficiently fast invalidation so restricted data does not remain discoverable.

---

## R2.22-27 — Resource Authorization Is Rechecked on Open

**Decision:** LOCKED

A stale search result must not bypass current authorization.

If a resource has been revoked/deleted, opening it must enforce the latest access rule.

---

## R2.22-28 — Search History Is Private by Default

**Decision:** LOCKED

Search history is not automatically visible to:

```text
School
Partner
Other Users
```

Retention/analytics remains subject to privacy policy.

---

## R2.22-29 — Sensitive Messaging/Search Actions May Require Audit

**Decision:** LOCKED

Not every normal search needs audit logging.

Sensitive access, export, Trust & Safety investigation, and selected messaging cases may require audit.

---

## R2.22-30 — Shared Capability Must Be Fault-Isolated

**Decision:** LOCKED

```text
Messaging Down
≠ CBT Down

Search Down
≠ Learn Data Lost

Notification Down
≠ Academic Core Down
```

---

## R2.22-31 — UI Follows Active Context

**Decision:** LOCKED

Messaging/search/notification actions must always respect the user's currently active organization/context.

No permission leakage between School, Partner, Alumni, or other contexts.

---

## R2.22-32 — Unread Counts Must Be Scalable

**Decision:** LOCKED

Architecture should support efficient unread/read-state counters without rescanning full message/notification history on every page load.

---

## R2.22-33 — School Broadcast Is Controlled

**Decision:** LOCKED

Authorized school staff may broadcast to scopes such as:

```text
Entire School
Grade Level
Class
Guardians
Selected Group
```

with preview/confirmation to reduce accidental sends.

---

## R2.22-34 — Sensitive Broadcast May Require Stronger Approval

**Decision:** LOCKED

High-impact/emergency broadcasts may require stronger permission or approval controls according to risk.

---

## R2.22-35 — Notification Source Authenticity

**Decision:** LOCKED

UI must distinguish legitimate sources such as:

```text
Official School
ELLIGBLE System
Partner
Teacher
Counselor
```

to reduce impersonation/phishing risk.

---

## R2.22-36 — Messaging Identity Must Show Capacity / Context

**Decision:** LOCKED

Examples:

```text
Ibu Sari
Guru Ekonomi • SMA X
```

```text
Andi
Recruiter • Company Y
```

Users should know who is communicating and in which role/context.

---

## R2.22-37 — Message Edit/Delete Uses Policy

**Decision:** LOCKED

Normal messages may support limited edit/delete windows.

Sensitive/official messages may preserve history or tombstones.

Silent rewriting of important communication history is rejected.

---

## R2.22-38 — Conversation Export Is Restricted

**Decision:** LOCKED

Care/Partner/sensitive conversation exports must respect:

```text
Permission
Purpose
Scope
Audit
Retention
```

---

## R2.22-39 — No Cross-Tenant Accidental Autocomplete

**Decision:** LOCKED

Autocomplete/user discovery must be limited by valid relationship/context.

A teacher in School A cannot automatically discover unrelated students in School B.

---

## R2.22-40 — Shared Communication/Search Product Principle

**Decision:** LOCKED

```text
DISCOVER WHAT YOU ARE ALLOWED TO SEE
+
COMMUNICATE ONLY WITH VALID RELATIONSHIPS
+
NOTIFY ONLY WHAT MATTERS
+
NEVER BYPASS DOMAIN AUTHORIZATION
```

---

## R2.22 Consolidated Result

```text
R2.22-01 Global Notification Center                → LOCKED
R2.22-02 Notification Priority                     → LOCKED
R2.22-03 Actionable Notifications                  → LOCKED
R2.22-04 Delivery Channels                         → LOCKED
R2.22-05 User Preferences                          → LOCKED
R2.22-06 Deduplication                             → LOCKED
R2.22-07 Reminder Engine                           → LOCKED
R2.22-08 Read/Unread ≠ Workflow                    → LOCKED
R2.22-09 Notification Retention                    → LOCKED
R2.22-10 Exam Notification Isolation               → LOCKED
R2.22-11 Scoped Messaging                          → LOCKED
R2.22-12 Conversation Context                      → LOCKED
R2.22-13 Context-End Messaging                     → LOCKED
R2.22-14 Abuse Reporting                           → LOCKED
R2.22-15 Private Care Messaging                    → LOCKED
R2.22-16 Restricted Exam Messaging                 → LOCKED
R2.22-17 Attachment Policy                         → LOCKED
R2.22-18 AI Chat Future Only                       → LOCKED — FUTURE
R2.22-19 Permission-Aware Search                   → LOCKED
R2.22-20 Context-Aware Results                     → LOCKED
R2.22-21 Result Type                               → LOCKED
R2.22-22 Care Search Privacy                       → LOCKED
R2.22-23 Opt-In Talent Search                      → LOCKED
R2.22-24 No Global Search in Exam Runtime          → LOCKED
R2.22-25 Derived Search Index                      → LOCKED
R2.22-26 Async Search Indexing                     → LOCKED
R2.22-27 Recheck Authorization                     → LOCKED
R2.22-28 Private Search History                    → LOCKED
R2.22-29 Sensitive Audit                           → LOCKED
R2.22-30 Fault Isolation                           → LOCKED
R2.22-31 Active Context                            → LOCKED
R2.22-32 Scalable Unread Counts                    → LOCKED
R2.22-33 Controlled Broadcast                      → LOCKED
R2.22-34 Sensitive Broadcast Approval              → LOCKED
R2.22-35 Source Authenticity                       → LOCKED
R2.22-36 Messaging Identity Context                → LOCKED
R2.22-37 Edit/Delete Policy                        → LOCKED
R2.22-38 Restricted Conversation Export            → LOCKED
R2.22-39 No Cross-Tenant Autocomplete              → LOCKED
R2.22-40 Product Principle                         → LOCKED
```

These decisions supersede assumptions that messaging is a free social layer or that global search may bypass domain authorization.

---

# 31. Notifications Recovery

Candidate channels:

```text
In-app
Push
Email
Future external channels
```

Potential triggers:

- exam;
- assignment;
- announcement;
- counseling;
- parent alert;
- opportunity;
- partner response;
- system/security.

**Status:** PROVISIONAL.

Push notification readiness is required for mobile architecture.

---


# 31A. RECOVERY-R2.23 Review Outcome — Insight, Billing, Platform Owner & Support Operations

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.23  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Insight, Billing, Platform Operations, and Support direction.

---

## R2.23-01 — Insight Is Role / Context Specific

**Decision:** LOCKED

ELLIGBLE does not use one universal analytics dashboard for all users.

Candidate contexts:

```text
Student Insight
Teacher Insight
School Leadership Insight
Partner Insight
Platform Insight
```

---

## R2.23-02 — Insight Uses Final / Derived Data

**Decision:** LOCKED

Preferred flow:

```text
Canonical Data
↓
Event / Background Processing
↓
Derived Metrics / Aggregation
↓
Insight
```

Mission-critical transactions such as Assessment submission must not wait for analytics.

---

## R2.23-03 — School Insight

**Decision:** LOCKED

Candidate aggregates:

```text
Active Students
Attendance
Learning Completion
Assessment Trend
Remedial Rate
Early-Warning Aggregate
Care Aggregate
Path Readiness Aggregate
Graduation
Alumni Outcome
```

Sensitive detail remains permission-controlled.

---

## R2.23-04 — Teacher Insight

**Decision:** LOCKED

Teacher analytics are scoped to valid teaching assignments and relevant classes/subjects.

---

## R2.23-05 — Student Insight

**Decision:** LOCKED

Student Insight emphasizes personal progress, learning, assessment, targets, Passport, and Path readiness rather than default ranking.

---

## R2.23-06 — Platform Owner Insight

**Decision:** LOCKED

Candidate operational overview:

```text
Active Tenants
Active Users
Platform Usage
Assessment Concurrency
Storage Usage
Error Rate
Incidents
Partner Ecosystem
Outcome Aggregates
Billing State
```

Platform-level visibility does not imply unrestricted personal-data access.

---

## R2.23-07 — Tenant Health

**Decision:** LOCKED

Candidate tenant health states:

```text
ONBOARDING
ACTIVE
WARNING
INCIDENT
SUSPENDED
```

Signals may include:

```text
User Activation
Import Errors
Assessment Incident
Storage Consumption
Integration Issue
Billing Issue
Security Event
```

---

## R2.23-08 — Analytics Must Show Denominator / Context

**Decision:** LOCKED

Metrics must include enough context to avoid misleading interpretation.

Example:

```text
Cohort Size
Known Outcomes
Unknown Outcomes
Coverage
Metric Denominator
```

---

## R2.23-09 — Data Freshness Is Visible

**Decision:** LOCKED

Important metrics may display:

```text
Last Updated
Data Coverage
Source
Period
```

---

## R2.23-10 — Analytics Export Is Permission-Based

**Decision:** LOCKED

Exports require appropriate:

```text
Permission
Scope
Purpose
Audit
```

No generic unrestricted “download entire database” capability.

---

## R2.23-11 — Core Modules Are Not Artificially Fragmented Into Paywalls

**Decision:** LOCKED

The default commercial principle remains:

> School customers receive the complete core module ecosystem.

Core educational functionality must not be arbitrarily disabled solely to force upgrades.

---

## R2.23-12 — Pricing Model Remains OPEN

**Decision:** LOCKED — BUSINESS MODEL OPEN

Candidate models for later discovery:

```text
Per Tenant
Per Active Student
Per Enrollment
Usage Tier
School Size
Annual License
Implementation Fee
Support / SLA
Storage / Usage Overage
Combination
```

Billing structure must not be hardcoded prematurely into core domain logic.

---

## R2.23-13 — Price Differentiation Uses Fair Operational Drivers

**Decision:** LOCKED

Candidate drivers:

```text
Student Count
Usage
Storage
Support Level
SLA
Implementation
Custom Integration
Optional Premium Service
```

---

## R2.23-14 — Billing Is Fault-Isolated From Assessment

**Decision:** LOCKED

```text
BILLING
≠
ASSESSMENT RUNTIME
```

Payment/provider problems cannot break active exam autosave/submission.

---

## R2.23-15 — Subscription Lifecycle

**Decision:** LOCKED — DIRECTION

Candidate states:

```text
TRIAL / PILOT
ACTIVE
PAYMENT_DUE
GRACE_PERIOD
RESTRICTED
SUSPENDED
ENDED
```

Final commercial rules remain subject to Business Model discovery.

---

## R2.23-16 — Graceful Commercial Enforcement

**Decision:** LOCKED

Commercial enforcement should follow safe boundaries:

```text
Invoice Overdue
↓
Reminder
↓
Grace Period
↓
Restriction at Safe Boundary
```

Active mission-critical academic/Assessment workflows must not be abruptly interrupted.

---

## R2.23-17 — Billing Provider Is an Adapter

**Decision:** LOCKED

Preferred architecture:

```text
Billing Domain
↓
PaymentProviderPort
↓
Provider Adapter
```

No hard dependency on one payment gateway.

---

## R2.23-18 — Platform Owner Is Governance Authority, Not Daily Operator

**Decision:** LOCKED

Platform Owner retains top governance authority.

Routine operations should use scoped `PLATFORM_STAFF` assignments.

---

## R2.23-19 — Internal Platform Operations Are Capability-Based

**Decision:** LOCKED

Candidate capability areas:

```text
Tenant Operations
Support
Trust & Safety
Partner Verification
Billing Operations
Security Operations
Platform Administration
```

---

## R2.23-20 — Tenant Management

**Decision:** LOCKED

Authorized internal staff may:

```text
Create / Onboard Tenant
Review Tenant Profile
Activate
Suspend
Restore
Update Operational Settings
View Tenant Health
Manage Organization-Group Relationship
```

according to capability.

---

## R2.23-21 — Tenant Suspension Preserves Data

**Decision:** LOCKED

Suspension does not automatically delete:

```text
Student Records
Assessment
Passport Provenance
Audit
Alumni Records
```

Retention follows separate policy.

---

## R2.23-22 — High-Risk Platform Actions Require Reason + Audit

**Decision:** LOCKED

Candidate high-risk actions:

```text
Suspend Tenant
Restore Tenant
Override Verification
Change Ownership
Elevate Privilege
Delete Large Dataset
Support Impersonation
```

may require:

```text
Reason
Actor
Timestamp
Audit
Maker-Checker where required
```

---

## R2.23-23 — Platform Staff Cannot Silently Edit Tenant Academic Data

**Decision:** LOCKED

Internal platform staff may not arbitrarily alter:

```text
Student Grades
Exam Answers
Verified Passport Records
```

Corrections must use domain-authorized workflows and audit.

---

## R2.23-24 — Trust & Safety Console

**Decision:** LOCKED — FUTURE OPERATIONAL WORKSPACE

Rule-based signals may include:

```text
Suspicious Privilege Escalation
Mass Data Export
Partner Abuse Report
Repeated Tenant Switching
Bulk Passport Correction
Unusual Support Access
Evidence Tampering Attempt
```

AI is not required.

---

## R2.23-25 — Security Operations Capability

**Decision:** LOCKED

Authorized Security Operations staff may:

```text
Revoke Sessions
Freeze Account
Review Security Events
Respond to Credential Exposure
Investigate Suspicious Activity
Handle Incident
```

without automatically receiving unrestricted academic-data access.

---

## R2.23-26 — Support Uses Cases / Tickets

**Decision:** LOCKED

Preferred model:

```text
SUPPORT CASE
↓
Category
Priority
Tenant / User
Assigned Agent
Status
Resolution
```

---

## R2.23-27 — Support Case Lifecycle

**Decision:** LOCKED

Candidate states:

```text
OPEN
TRIAGED
IN_PROGRESS
WAITING_USER
WAITING_INTERNAL
RESOLVED
CLOSED
REOPENED
```

---

## R2.23-28 — Support Priority

**Decision:** LOCKED

Candidate levels:

```text
P1 CRITICAL
P2 HIGH
P3 NORMAL
P4 LOW
```

Final SLA targets remain subject to later business/operations discovery.

---

## R2.23-29 — Assessment Incidents Receive Highest Operational Priority

**Decision:** LOCKED

Active exam / severe submission / platform-security incidents outrank cosmetic or low-impact issues.

---

## R2.23-30 — Support Never Requests Password

**Decision:** LOCKED

Any future support access must use an authorized, scoped, auditable mechanism.

---

## R2.23-31 — Support Impersonation Must Be Visible

**Decision:** LOCKED

If implemented:

```text
SUPPORT ACCESS ACTIVE
Agent
Reason
Scope
Expiry
```

must be clearly represented.

---

## R2.23-32 — Support Impersonation Is Time-Bound

**Decision:** LOCKED

Support-access sessions must automatically expire.

Exact duration depends on risk and need.

---

## R2.23-33 — Support Does Not Automatically Access Care Data

**Decision:** LOCKED

Private counseling/Care records remain separately protected even during support workflows.

---

## R2.23-34 — Safe Diagnostic Bundle

**Decision:** LOCKED

Candidate diagnostic metadata:

```text
App Version
Tenant ID
Request Reference
Error Code
Browser / Device Info
Timestamp
Service Status
```

Sensitive secrets/content must not be included by default.

---

## R2.23-35 — Incident Status Communication

**Decision:** LOCKED

Candidate states:

```text
INVESTIGATING
IDENTIFIED
MONITORING
RESOLVED
```

Tenants should be able to understand active platform incidents without repeated support contact.

---

## R2.23-36 — Platform Announcement Is Distinct From School Announcement

**Decision:** LOCKED

```text
ELLIGBLE PLATFORM ANNOUNCEMENT
≠
SCHOOL ANNOUNCEMENT
```

Source authenticity must remain clear.

---

## R2.23-37 — Maintenance Must Respect Exam Schedules

**Decision:** LOCKED

High-risk maintenance must consider:

```text
Active Exams
Scheduled Exams
Tenant Timezone
Peak Usage
```

Assessment-related maintenance follows stricter procedures.

---

## R2.23-38 — Feature Rollout Is Staged

**Decision:** LOCKED

Candidate rollout stages:

```text
Internal
Pilot Tenant
Selected Tenants
Percentage Rollout
General Availability
```

Feature flags support controlled deployment, not arbitrary customer discrimination.

---

## R2.23-39 — Rollback Must Be Available

**Decision:** LOCKED

Candidate response:

```text
Detect
↓
Stop Rollout
↓
Rollback / Disable Feature
↓
Verify
↓
Incident Review
```

---

## R2.23-40 — AI for Insight / Support / Operations Is FUTURE Only

**Decision:** LOCKED — FUTURE ONLY

Baseline uses:

```text
Structured Dashboard
Rule-Based Alert
Support Workflow
Query / Filter
Deterministic Analytics
```

Potential AI features such as:

```text
AI Support Assistant
AI Incident Summary
AI Anomaly Detection
AI Analytics Narrative
```

remain optional future enhancements.

---

## R2.23 Product Principle

```text
PLATFORM OWNER
governs the platform

PLATFORM STAFF
operates with scoped capability

INSIGHT
explains authorized data

BILLING
manages commercial lifecycle

SUPPORT
resolves operational problems

SECURITY / TRUST
protects the ecosystem

ASSESSMENT
remains isolated from failures in all of them
```

---

## R2.23 Consolidated Result

```text
R2.23-01 Context-Specific Insight                → LOCKED
R2.23-02 Derived Analytics                       → LOCKED
R2.23-03 School Insight                          → LOCKED
R2.23-04 Teacher Insight                         → LOCKED
R2.23-05 Student Insight                         → LOCKED
R2.23-06 Platform Insight                        → LOCKED
R2.23-07 Tenant Health                           → LOCKED
R2.23-08 Denominator / Coverage                  → LOCKED
R2.23-09 Data Freshness                          → LOCKED
R2.23-10 Scoped Export                           → LOCKED
R2.23-11 Full Core Module Principle              → LOCKED
R2.23-12 Pricing Model                           → OPEN
R2.23-13 Fair Pricing Drivers                     → LOCKED
R2.23-14 Billing Fault Isolation                 → LOCKED
R2.23-15 Subscription Lifecycle                  → LOCKED — DIRECTION
R2.23-16 Grace Period                            → LOCKED
R2.23-17 Billing Provider Adapter                → LOCKED
R2.23-18 Platform Owner Governance               → LOCKED
R2.23-19 Platform Staff Capability Model         → LOCKED
R2.23-20 Tenant Management                       → LOCKED
R2.23-21 Suspension Preserves Data               → LOCKED
R2.23-22 High-Risk Action Control                → LOCKED
R2.23-23 No Silent Academic Editing              → LOCKED
R2.23-24 Trust & Safety Console                  → LOCKED — FUTURE WORKSPACE
R2.23-25 Security Operations                     → LOCKED
R2.23-26 Support Case Model                      → LOCKED
R2.23-27 Support Lifecycle                       → LOCKED
R2.23-28 Support Priority                        → LOCKED
R2.23-29 Assessment Priority                     → LOCKED
R2.23-30 No Password Support                     → LOCKED
R2.23-31 Visible Support Access                  → LOCKED
R2.23-32 Time-Bound Support Access               → LOCKED
R2.23-33 Care Privacy During Support              → LOCKED
R2.23-34 Diagnostic Bundle                       → LOCKED
R2.23-35 Incident Communication                  → LOCKED
R2.23-36 Platform vs School Announcement          → LOCKED
R2.23-37 Exam-Aware Maintenance                  → LOCKED
R2.23-38 Staged Rollout                          → LOCKED
R2.23-39 Rollback                                → LOCKED
R2.23-40 AI Future Only                          → LOCKED — FUTURE
```

These decisions supersede assumptions that platform operations, billing, support, and analytics may directly interfere with mission-critical academic workflows.

---

# 32. Messaging Recovery

Candidate:

- student-teacher;
- school-parent;
- student-alumni mentorship;
- student-partner with restrictions;
- support communication.

**Status:** PROVISIONAL.

Safety/moderation/consent rules remain OPEN.

---


# 32A. RECOVERY-R2.24 Review Outcome — Business Model & Commercial Boundaries

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.24  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

The Platform Owner approved the complete Business Model & Commercial Boundaries direction.

---

## R2.24-01 — ELLIGBLE Uses a B2B2C Model

**Decision:** LOCKED

Primary structure:

```text
ELLIGBLE
↓
School as Customer / Tenant
↓
Teacher / Student / Parent
```

Students do not need an individual paid subscription to use core ELLIGBLE through their school.

---

## R2.24-02 — School Is the Primary Initial Payer

**Decision:** LOCKED

Primary early revenue direction:

```text
School Subscription / License
```

rather than advertising to students.

---

## R2.24-03 — Pilot Tenant May Use Special Commercial Terms

**Decision:** LOCKED

SMA N 1 Mlati as pilot/reference tenant may use:

```text
FREE PILOT
DISCOUNTED PILOT
SPECIAL EARLY-ADOPTER AGREEMENT
```

Pilot economics do not automatically define future standard pricing.

---

## R2.24-04 — Final Pricing Remains OPEN

**Decision:** LOCKED — PRICING OPEN

Final pricing must be decided after evaluating:

```text
Infrastructure Cost
Storage
Assessment Concurrency
Support Burden
School Size
Implementation Effort
Market Willingness to Pay
```

---

## R2.24-05 — No Artificial Paywall Per Core Module

**Decision:** LOCKED

Core ecosystem:

```text
Learn
Assess
Track
Care
Parent
Passport
Path
```

should not be arbitrarily split into separate paywalls that undermine the platform's intended value.

---

## R2.24-06 — Price Differentiation Uses Scale / Usage / Service

**Decision:** LOCKED

Candidate pricing drivers:

```text
Active Student Count
Tenant Size
Storage
Assessment Usage / Concurrency
Support Level
SLA
Implementation
Custom Integration
Additional Infrastructure Usage
```

---

## R2.24-07 — Packages May Exist Without Breaking Core Entitlement

**Decision:** LOCKED

Potential commercial tiers may differ by:

```text
Capacity
SLA
Support
Implementation
Integration
Infrastructure
```

not by removing the essential product identity of ELLIGBLE.

---

## R2.24-08 — Implementation Fee May Be Separate

**Decision:** LOCKED

Possible one-time implementation services:

```text
Data Migration
Initial Setup
Training
Custom Integration
On-Site Support
Historical Import
```

---

## R2.24-09 — Support / SLA May Be a Commercial Differentiator

**Decision:** LOCKED

Possible offerings:

```text
Standard Support
Priority Support
Dedicated / Enterprise SLA
```

However critical active-assessment incidents remain operationally important regardless of package.

---

## R2.24-10 — Storage / Usage Overage Is Allowed

**Decision:** LOCKED

Candidate model:

```text
Included Storage
+
Additional Storage / Usage
```

Policies must be transparent and must not jeopardize active assessment data safety.

---

## R2.24-11 — Commercial Limits Cannot Break Active Exams

**Decision:** LOCKED

Quota/billing enforcement must occur at safe boundaries.

Active exam:

```text
Answer Persistence
Autosave
Submission
```

must not fail because of commercial enforcement.

---

## R2.24-12 — Full White-Label Is Not the Default

**Decision:** LOCKED

School branding may include:

```text
Logo
Name
Profile
Selected Branding
```

while ELLIGBLE remains the platform brand.

---

## R2.24-13 — Custom Domain Is FUTURE / Optional

**Decision:** LOCKED — FUTURE OPTION

Default platform domain may use ELLIGBLE infrastructure.

Custom domain/subdomain may become a future commercial/technical option.

It is not required for the first pilot release.

---

## R2.24-14 — Partner Has a Separate Commercial Model

**Decision:** LOCKED

Potential partner revenue sources may include:

```text
Partner Subscription
Recruitment Tools
Opportunity Management
Verified Organization Services
Campaign / Event Service
Advanced Analytics
Integration
```

Partner payment never grants broad student-data access.

---

## R2.24-15 — Verification Cannot Be Purchased

**Decision:** LOCKED

```text
PAYMENT
≠
VERIFICATION
```

Verification remains a trust/security process.

---

## R2.24-16 — Sponsored Opportunity Is FUTURE and Must Be Labeled

**Decision:** LOCKED — FUTURE OPTION

If introduced:

```text
SPONSORED
```

must be explicit.

```text
Sponsored
≠
Most Relevant
≠
Most Eligible
```

---

## R2.24-17 — No Pay-to-Win Path Ranking

**Decision:** LOCKED

Partners cannot pay to make an irrelevant opportunity appear as the best recommendation.

Relevance and commercial sponsorship remain separate.

---

## R2.24-18 — Recruitment / Success Fee Is OPEN

**Decision:** LOCKED — FUTURE BUSINESS MODEL OPEN

Potential models:

```text
Successful Hire
Successful Internship Placement
Successful Enrollment
Qualified Applicant
```

require later commercial/legal validation.

---

## R2.24-19 — High-Value Opportunities Need Not Always Pay

**Decision:** LOCKED

Useful opportunities such as scholarships should not be excluded merely because the provider is not monetized.

---

## R2.24-20 — Merchant Ecosystem Is Secondary

**Decision:** LOCKED

Product priority:

```text
Education / Future Outcome
>
Commercial Transaction
```

ELLIGBLE must not evolve into an e-commerce product whose educational purpose becomes secondary.

---

## R2.24-21 — No Advertising During Active Exam / Sensitive Care

**Decision:** LOCKED

```text
ACTIVE EXAM
→ NO ADS
→ NO SPONSORED CONTENT
→ NO COMMERCIAL DISTRACTION
```

Sensitive Care/counseling workspaces also exclude commercial distraction.

---

## R2.24-22 — Student Data Is Not Sold

**Decision:** LOCKED — COMMERCIAL PRINCIPLE

ELLIGBLE does not sell student databases to:

```text
Advertisers
Recruiters
Merchants
Partners
Other Third Parties
```

Revenue must come from legitimate product/service value.

---

## R2.24-23 — Aggregate Insight Must Not Become a Re-Identification Product

**Decision:** LOCKED

Aggregates may be provided when authorized, but ELLIGBLE does not commercialize identifiable lists of students without lawful purpose/consent.

---

## R2.24-24 — Billing Belongs to Tenant / Organization

**Decision:** LOCKED

School billing is associated with:

```text
Tenant / Organization
```

not the student's global Person Identity.

A student transfer does not carry the old tenant's billing obligation.

---

## R2.24-25 — Organization Group Billing Is Extensible

**Decision:** LOCKED

A foundation/group may later support centralized billing while each school remains an isolated tenant.

---

## R2.24-26 — Partner Group Billing Is Extensible

**Decision:** LOCKED

Holding/company groups may have centralized commercial arrangements while organization permissions remain scoped.

---

## R2.24-27 — No AI Cost Dependency in Baseline Pricing

**Decision:** LOCKED

Baseline ELLIGBLE pricing must not depend on LLM/token usage or paid AI subscriptions.

Future AI capabilities may be:

```text
Optional
Explicit
Separately Costed where necessary
```

without affecting core product operation.

---

## R2.24-28 — Renewal / Invoice Policy Must Be Transparent

**Decision:** LOCKED

Billing UX must clearly communicate:

```text
Billing Period
Invoice
Due Date
Renewal
Grace Period
Restriction
Cancellation
```

and must avoid dark patterns.

---

## R2.24-29 — Data Portability After Subscription End

**Decision:** LOCKED

Candidate lifecycle:

```text
Subscription Ended
↓
Read / Export Window according to policy
↓
Retention Period
↓
Deletion / Archival according to contract and law
```

Academic and assessment records require careful handling.

---

## R2.24-30 — Commercial Product Principle

**Decision:** LOCKED

```text
SCHOOL PAYS
for operational platform value

PARTNER PAYS
for legitimate ecosystem tools / services

STUDENT / PARENT
receive core educational value through their school

ELLIGBLE EARNS
without selling student privacy
or corrupting opportunity relevance
```

---

## R2.24 Consolidated Result

```text
R2.24-01 B2B2C                                  → LOCKED
R2.24-02 School Primary Payer                    → LOCKED
R2.24-03 Pilot Commercial Terms                  → LOCKED
R2.24-04 Final Pricing                           → OPEN
R2.24-05 No Core Module Paywall                  → LOCKED
R2.24-06 Scale / Usage Pricing Drivers           → LOCKED
R2.24-07 Fair Package Differentiation            → LOCKED
R2.24-08 Implementation Fee                      → LOCKED
R2.24-09 Support / SLA Differentiation           → LOCKED
R2.24-10 Storage / Usage Overage                 → LOCKED
R2.24-11 Exam Commercial Isolation               → LOCKED
R2.24-12 No Default Full White-Label             → LOCKED
R2.24-13 Custom Domain                           → FUTURE
R2.24-14 Partner Commercial Model                → LOCKED
R2.24-15 Verification ≠ Payment                  → LOCKED
R2.24-16 Sponsored Opportunity                   → FUTURE
R2.24-17 No Pay-to-Win Ranking                   → LOCKED
R2.24-18 Success Fee                             → OPEN / FUTURE
R2.24-19 Non-Paid Valuable Opportunities         → LOCKED
R2.24-20 Merchant Secondary                      → LOCKED
R2.24-21 No Ads in Exam / Care                   → LOCKED
R2.24-22 Student Data Not Sold                   → LOCKED
R2.24-23 No Re-Identification Commercialization  → LOCKED
R2.24-24 Tenant-Based Billing                    → LOCKED
R2.24-25 Organization Group Billing              → LOCKED
R2.24-26 Partner Group Billing                   → LOCKED
R2.24-27 No AI Cost Dependency                   → LOCKED
R2.24-28 Transparent Renewal / Invoice            → LOCKED
R2.24-29 Post-Subscription Portability           → LOCKED
R2.24-30 Commercial Product Principle            → LOCKED
```

These decisions supersede conflicting assumptions that ELLIGBLE monetization should rely on selling student data, intrusive advertising, or artificial fragmentation of essential education modules.

---


# 32B. RECOVERY-R2.25 Review Outcome — Legal, Privacy, Consent, Data Governance & Retention

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.25  
**Owner Approval:** APPROVED — OVERALL AGREEMENT  
**Note:** Detailed legal wording, controller/processor allocation, retention periods, and contracts remain subject to dedicated Indonesian legal/privacy review before production.

---

## Locked Legal / Privacy Direction

### R2.25-01 — Privacy by Design
**Decision:** LOCKED

Every domain must define data collected, purpose, access, modification rights, retention, data flow, consent/legal basis, and audit requirements before implementation is considered complete.

### R2.25-02 — Consent Is Not the Only Processing Basis
**Decision:** LOCKED

The architecture must support explicit processing-purpose/legal-basis mapping rather than using a universal consent checkbox for every operation.

### R2.25-03 — Consent Is Granular and Evidenced
**Decision:** LOCKED

Where consent is applicable, ELLIGBLE should retain:

```text
Purpose
Data Requested
Recipient
Consent Version
Granted At
Expiry where applicable
Withdrawn At
```

### R2.25-04 — Child / Minor Data Requires Special Handling
**Decision:** LOCKED

The data model and UX must be able to represent:

```text
Minor / Child Status
Guardian Relationship
Guardian Authorization / Consent where legally applicable
Consent Version
Purpose
Lifecycle Transition
```

Final age/legal mechanics remain subject to Legal Discovery.

### R2.25-05 — Guardian Authorization Does Not Equal Full Student Access
**Decision:** LOCKED

Guardian legal/consent status must not be translated into unrestricted technical visibility. Parent access remains purpose- and policy-limited.

### R2.25-06 — Consent / Guardian Model Is Lifecycle-Aware
**Decision:** LOCKED

The system must support transition from minor student to adult/alumni without making guardian access permanent by default.

### R2.25-07 — Child Safety Is a Hard Product Boundary
**Decision:** LOCKED

Required capabilities include safe defaults, report-abuse paths, scoped messaging, partner moderation, relationship restrictions, and Trust & Safety escalation.

### R2.25-08 — Data Inventory / Processing Register
**Decision:** LOCKED

ELLIGBLE will require a separate data inventory covering at minimum:

```text
Identity
Academic
Assessment
Attendance
Passport
Care
Guardian
Partner / Application
Location
Device
Security
Evidence
Communication
Billing
Alumni Outcome
```

### R2.25-09 — Data Classification
**Decision:** LOCKED

Candidate classification:

```text
PUBLIC
INTERNAL
CONFIDENTIAL
HIGHLY_SENSITIVE
PROTECTED_EVIDENCE
```

### R2.25-10 — Sensitive Categories Receive Stronger Controls
**Decision:** LOCKED

Child, health-related, biometric, Care, camera, evidence, and other sensitive data must not be treated as ordinary application data.

### R2.25-11 — Controller / Processor Roles Must Be Explicit
**Decision:** LOCKED — LEGAL ALLOCATION OPEN

For each processing flow the relevant legal/operational role of:

```text
School
ELLIGBLE
Infrastructure Provider
Payment Provider
Messaging / Notification Provider
Partner
Other Vendor
```

must be documented.

Exact legal allocation remains `OPEN` until Legal Discovery.

### R2.25-12 — Data Source / Control / Custody Are More Precise Than “Ownership”
**Decision:** LOCKED

The design should distinguish:

```text
School-Originated Records
User-Controlled / Portable Data
Platform Operational Data
Partner-Originated Data
```

and document source, controller, custodian, access rights, portability, and retention.

### R2.25-13 — Global Identity Does Not Collapse Tenant Ownership
**Decision:** LOCKED

A global Person ID links identity continuity but does not grant School A rights over School B records.

### R2.25-14 — School Transfer Preserves Provenance
**Decision:** LOCKED

Old school records remain old-school provenance; only approved portable/verified records move or become visible according to policy.

### R2.25-15 — Data Access Request Workflow
**Decision:** LOCKED

Candidate:

```text
Request
↓
Identity Verification
↓
Scope Review
↓
Fulfil / Lawful Rejection
↓
Audit
```

### R2.25-16 — Correction Uses History
**Decision:** LOCKED

Critical correction:

```text
Original
↓
Correction
↓
Reason
↓
New Version
↓
Audit
```

not silent overwrite.

### R2.25-17 — Deletion Has Multiple Meanings
**Decision:** LOCKED

The product must distinguish:

```text
Delete Account
Delete Profile Data
End Membership
Revoke Consent
Anonymize
Archive
Retain
Destroy
```

### R2.25-18 — Retention Matrix Is Mandatory
**Decision:** LOCKED

A dedicated retention matrix will define:

```text
Data Type
Purpose
Retention Start
Retention Period
Legal / Contract Basis
Archive Rule
Delete Rule
Anonymize Rule
Owner / Approver
```

### R2.25-19 — Assessment Evidence Has Separate Retention
**Decision:** LOCKED

Exam answer, submission, violation event, camera evidence, and audit trail may have different retention periods.

### R2.25-20 — Care Retention Is Separate
**Decision:** LOCKED

Counseling/Care retention must be separately defined from academic, Passport, and Assessment data.

### R2.25-21 — Application Snapshot Is Historical
**Decision:** LOCKED

An application-specific Passport snapshot remains immutable for its valid retention period even if the live Passport changes.

### R2.25-22 — Consent Withdrawal Has Operational Effect
**Decision:** LOCKED

For processing that depends on consent:

```text
Consent Withdrawn
↓
Stop Applicable New Processing / Access
↓
Apply Retention / Legal Exceptions
↓
Audit
```

### R2.25-23 — Withdrawal Does Not Manipulate Historical Audit
**Decision:** LOCKED

Stopping future discoverability/access does not silently erase prior lawful applications, consent records, or required audit history.

### R2.25-24 — DPIA / Privacy Impact Assessment for High-Risk Processing
**Decision:** LOCKED

Likely candidates include:

```text
Large-Scale Student Data
Anti-Cheating Monitoring
Camera Evidence
Location
Care
Passport Matching
Talent Discovery
Future Biometrics
Cross-Domain Profiling
```

### R2.25-25 — No Hidden High-Impact Automated Decisions
**Decision:** LOCKED

Existing principles remain:

```text
Risk Score ≠ Guilty
Readiness ≠ Admission Prediction
Early Warning ≠ Diagnosis
```

Human review and explainability remain required where impact is significant.

### R2.25-26 — Processing Activity Logging
**Decision:** LOCKED

ELLIGBLE must prepare for a formal processing-activity register in addition to normal security/application audit logs.

### R2.25-27 — Formal Data-Breach Response
**Decision:** LOCKED

Required architecture/workflow should support:

```text
Detect
Classify
Contain
Identify Affected Data / Users
Preserve Evidence
Privacy / Legal Assessment
Notification Workflow
Recover
Post-Incident Review
```

### R2.25-28 — Privacy / Data Protection Function
**Decision:** LOCKED — ORGANIZATIONAL FORM OPEN

The platform must be ready for a formal Privacy/Data Protection function as scale and legal obligations require.

### R2.25-29 — Vendor / Subprocessor Register
**Decision:** LOCKED

Every external service handling ELLIGBLE data should have documented:

```text
Vendor
Purpose
Data Categories
Processing / Storage Location
Subprocessor
Contract
Security
Retention
Transfer
```

Agents must not introduce random SaaS dependencies without review.

### R2.25-30 — Cross-Border Data Transfer Requires Governance
**Decision:** LOCKED

Before using providers that process/store data outside Indonesia, ELLIGBLE must know where data goes, who receives it, and what safeguards apply.

### R2.25-31 — Secrets / Logs Must Minimize Personal Data
**Decision:** LOCKED

Logs must avoid dumping:

```text
Passwords
Tokens
Private Care Text
Raw Passport
Camera Images
Full Exam Payloads
```

when safe IDs, trace references, and error codes are sufficient.

### R2.25-32 — Analytics Uses Minimization
**Decision:** LOCKED

Prefer aggregated/pseudonymized/minimum-required data for platform analytics wherever appropriate.

### R2.25-33 — Development/Test Uses Dummy or Sanitized Data
**Decision:** LOCKED

Production student data must not be the default testing dataset.

### R2.25-34 — Anti-Cheating Capture Requires Clear Notice
**Decision:** LOCKED

If screenshots/camera evidence are enabled, students must receive an understandable pre-exam notice describing collection, purpose, conditions, access, and retention.

### R2.25-35 — Location Requires a Defined Purpose
**Decision:** LOCKED

Location is collected only where needed for an approved purpose, using the minimum useful precision and controlled retention/access.

### R2.25-36 — Partner Consent Screen Must Be Clear
**Decision:** LOCKED

Application/data-sharing screens must identify:

```text
Partner
Opportunity
Purpose
Data Fields
Access / Retention Window
Student Action
```

### R2.25-37 — Terms / Privacy / Consent Are Separate Concepts
**Decision:** LOCKED

The product/governance model distinguishes:

```text
Terms of Service
Privacy Notice
Processing Notice
Consent
School Agreement
Partner Agreement
```

### R2.25-38 — User-Facing Privacy Center
**Decision:** LOCKED — DIRECTION

Candidate areas:

```text
Data & Account
Guardian Relationships
Passport Visibility
Talent Discoverability
Partner Consents
Active Sessions
Data Requests
Account / Relationship Controls
```

### R2.25-39 — School Agreement Needs Data-Processing Terms
**Decision:** LOCKED

Contracts later need to address:

```text
Roles / Responsibilities
Purpose
Security
Support Access
Subprocessors
Incident Handling
Retention
Termination
Portability
```

### R2.25-40 — Legal / Data Governance Product Principle
**Decision:** LOCKED

```text
COLLECT LESS
↓
KNOW WHY
↓
KNOW WHO CONTROLS IT
↓
LIMIT ACCESS
↓
RECORD CONSENT / LEGAL BASIS
↓
PROTECT IT
↓
KEEP IT ONLY AS LONG AS JUSTIFIED
↓
ALLOW VALID USER RIGHTS
↓
AUDIT THE PROCESS
```

Student/child protection takes precedence over engagement and monetization goals.

---

## R2.25 Consolidated Result

```text
Privacy by Design                          → LOCKED
Processing Purpose / Legal Basis          → LOCKED
Granular Consent                          → LOCKED
Child / Guardian Data Handling            → LOCKED
Lifecycle-Aware Consent                   → LOCKED
Child Safety                              → LOCKED
Data Inventory / Classification           → LOCKED
Controller / Processor Allocation         → OPEN for Legal Discovery
Tenant / Portable / Platform Provenance   → LOCKED
Access / Correction / Deletion Workflows  → LOCKED
Retention Matrix                          → LOCKED
Assessment / Care Retention Separation    → LOCKED
DPIA for High-Risk Processing             → LOCKED
Automated-Decision Safeguards             → LOCKED
Processing Register                       → LOCKED
Data-Breach Workflow                      → LOCKED
Privacy/Data Protection Function          → LOCKED — FORM OPEN
Vendor / Subprocessor Governance          → LOCKED
Cross-Border Transfer Governance          → LOCKED
Data Minimization                         → LOCKED
Test-Data Safety                          → LOCKED
Camera / Location Transparency            → LOCKED
Partner Consent Transparency              → LOCKED
Privacy Center                            → LOCKED — DIRECTION
School Data-Processing Terms              → LOCKED
```

---

# 32C. CROSS-CUTTING RECOVERY ADDENDUM — Role-Aware Feedback & Support

**Requirement Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT  
**Detailed Routing / SLA:** PROVISIONAL — TO BE FINALIZED IN DISCOVERY  
**Requested by Platform Owner:** Every user and every role must have accessible Feedback & Support.

This is a shared platform capability, not a new social-messaging domain.

## FBS-01 — One Entry Point, Context-Aware Routing

Every supported user context should have access to:

```text
Bantuan & Feedback
```

The entry point may be available from:

```text
Profile / Account Menu
Help Menu
Contextual “Laporkan Masalah”
Critical Module Entry Point where needed
```

The system automatically includes active context:

```text
User
Role / Assignment
Tenant / Partner Organization
Current Module
Current Page / Workflow
Timestamp
Safe Technical Context
```

without exposing secrets.

---

## FBS-02 — Feedback and Support Are Different

```text
SUPPORT
= something is broken / blocked / requires action

FEEDBACK
= suggestion / experience / feature request / complaint / idea
```

Support creates an operational case with priority and resolution tracking.

Feedback may enter a product/service feedback queue without pretending to have the same SLA as an incident.

---

## FBS-03 — Baseline Categories

Candidate categories:

```text
Account / Login / Access
Academic Data
Learn
Assessment / Exam
Track
Care / BK
Parent
Passport
Path
Partner / Opportunity
Notification / Messaging / Search
Technical Bug
Security / Privacy
Abuse / Safety
Billing / Subscription — authorized roles
Feature Suggestion
General Feedback
Other
```

The UI should show only categories relevant to the current role/context where possible.

---

## FBS-04 — Role-Aware Routing Matrix

### Student

```text
Class / schedule / school-owned academic issue
→ School Admin / Operator / Authorized School Queue

Learn content / assignment issue
→ Relevant School Academic Queue / Teacher workflow where appropriate

Active exam problem
→ Exam / Proctor Support Queue
→ Escalate to ELLIGBLE P1 if platform incident

Account / app bug
→ School first-line or ELLIGBLE Technical Support according to category

Security / privacy / abuse
→ Restricted Security / Privacy / Trust & Safety route

General product feedback
→ ELLIGBLE Feedback
```

### Parent / Guardian

```text
Attendance / academic / school process
→ School Support

Guardian relationship / app issue
→ School or ELLIGBLE according to ownership

Privacy / security / abuse
→ Restricted specialized route

Product feedback
→ ELLIGBLE Feedback
```

### Teacher / Proctor / Counselor / School Staff

```text
Academic master-data / tenant operation
→ School Admin / Operator

Platform bug / technical issue
→ ELLIGBLE Support

Active assessment incident
→ School Exam Operations
+ ELLIGBLE escalation when platform-related

Care technical issue
→ Technical Support using privacy-safe diagnostic data
NOT automatic sharing of private counselor notes
```

### Principal / High-Privilege School Admin

```text
Tenant operational support
Billing / subscription
Security incident
Platform issue
Integration / onboarding
→ Appropriate ELLIGBLE Operations Queue
```

### Partner Staff

```text
Organization membership
→ Partner Admin

Verification
→ ELLIGBLE Partner Verification

Opportunity / applicant technical issue
→ ELLIGBLE Partner Support

Abuse / privacy / security
→ Trust & Safety / Privacy / Security
```

### Alumni

```text
Historical school record
→ Relevant School / Alumni Support Route

Passport / Path / account / platform issue
→ ELLIGBLE Support

Product feedback
→ ELLIGBLE Feedback
```

### Platform Staff / Platform Owner

Internal users use scoped operational queues such as:

```text
Support
Security Operations
Trust & Safety
Partner Verification
Billing Operations
Tenant Operations
Engineering / Incident
```

according to assignment.

---

## FBS-05 — School Support vs ELLIGBLE Support

The user should not need to understand internal ownership before asking for help.

Preferred UX:

```text
User explains issue
↓
Selects relevant category / context
↓
Routing rules determine owner
↓
Case assigned
↓
Escalation if wrong owner / deeper platform issue
```

Do not force users to guess:

```text
“Is this a school bug or an ELLIGBLE bug?”
```

before creating a case.

Baseline routing should be deterministic/rule-based, not AI-dependent.

---

## FBS-06 — Direct Specialized Routes

Some categories must be allowed to bypass ordinary school routing where appropriate:

```text
Security
Privacy
Abuse / Harassment
Partner Misuse
Platform Integrity
Sensitive Trust & Safety Report
```

This prevents a complaint from being routed only to the party that may itself be involved.

Exact confidentiality/anonymity policy remains OPEN for Trust & Safety / Legal Discovery.

---

## FBS-07 — Support Case Lifecycle

Candidate:

```text
OPEN
TRIAGED
IN_PROGRESS
WAITING_USER
WAITING_SCHOOL
WAITING_ELLIGBLE
ESCALATED
RESOLVED
CLOSED
REOPENED
```

Users should be able to see the status of their own support cases.

---

## FBS-08 — Priority

Candidate:

```text
P1 CRITICAL
P2 HIGH
P3 NORMAL
P4 LOW
```

Examples:

```text
Active exam cannot save / submit
→ P1

Login blocks school operations
→ P2

Normal functional bug
→ P3

Suggestion / minor issue
→ P4 / Feedback
```

Final SLA remains subject to Operations discovery.

---

## FBS-09 — Exam-Specific “Laporkan Masalah” Entry Point

During active Assessment, the student/proctor should not need to leave the exam shell to report a technical incident.

Candidate:

```text
Laporkan Masalah
↓
Issue Type
↓
Safe diagnostic context attached
↓
Proctor / Exam Support notified
↓
Platform escalation if required
```

Hard rule:

> Creating a support case must not block or interfere with answer persistence, timer authority, autosave, or submission.

---

## FBS-10 — Privacy-Safe Diagnostic Context

Where useful, support cases may automatically attach safe technical metadata:

```text
Tenant ID
User / Context Reference
Module
App Version
Browser / OS
Device Category
Timestamp
Error Code
Request / Trace Reference
Network State where relevant
Exam Session Reference where authorized
```

Must NOT automatically attach:

```text
Password
Token
Private Care Note
Full Passport
Raw Camera Evidence
Full Exam Answer Payload
Unrelated Personal Data
```

---

## FBS-11 — Attachment Support

Users may attach screenshots/files where appropriate.

Attachments require:

```text
File Type / Size Policy
Access Control
Retention
Security Validation where feasible
Audit for sensitive cases
```

Sensitive screens should warn users not to expose unnecessary personal information.

---

## FBS-12 — Feedback Types

Candidate feedback:

```text
Feature Request
UX Feedback
Bug Report
School Service Feedback
ELLIGBLE Service Feedback
Partner / Opportunity Feedback
Content / Information Correction
Accessibility Feedback
Other Suggestion
```

Feedback can be tagged by role/context so Product/Operations can understand who experiences the problem.

---

## FBS-13 — Feedback Must Not Become Public Social Posting

Feedback is a private service/product channel unless explicitly designed otherwise.

No public complaint feed, likes, follower mechanics, or engagement incentives are required.

---

## FBS-14 — Support Escalation

Candidate escalation:

```text
L1 School Support
↓ when platform issue
L2 ELLIGBLE Support
↓ when specialized
Security / Privacy / Trust & Safety / Engineering / Billing / Partner Ops
```

Not every case must start at L1 if routing rules clearly identify a specialized category.

---

## FBS-15 — Case History and Audit

Important events:

```text
Created
Assigned
Reassigned
Escalated
Priority Changed
Sensitive Access
User Response
Internal Resolution
Resolved
Reopened
Closed
```

should remain traceable.

---

## FBS-16 — Satisfaction / Closure Feedback

After resolution, the user may optionally provide simple service feedback such as:

```text
Masalah selesai?
YES / NO

Rating / short comment — optional
```

This is service-quality feedback, not social reputation scoring of individual teachers/students.

---

## FBS-17 — Knowledge / Self-Help Can Be Added Later

Contextual FAQs/help articles may reduce repetitive tickets.

No AI chatbot is required.

Future AI support assistance remains:

```text
FUTURE
OPTIONAL
NON-BLOCKING
```

---

## FBS-18 — Core Product Principle

```text
EVERY USER CAN ASK FOR HELP
+
THE SYSTEM KNOWS THEIR CONTEXT
+
THE CASE GOES TO THE RIGHT RESPONSIBLE PARTY
+
SENSITIVE REPORTS HAVE SAFE ROUTES
+
THE USER CAN TRACK RESOLUTION
+
ASSESSMENT REMAINS FAULT-ISOLATED
```

This cross-cutting requirement applies to all existing and future ELLIGBLE roles.

---

# 33. Search Recovery

Candidate global search:

- users;
- school content;
- material;
- assessments;
- communities;
- alumni;
- partner;
- opportunity.

**Status:** PROVISIONAL / FUTURE depending domain.

---

# 34. Billing Recovery

Potential:

- school subscription;
- package;
- trial;
- upgrade;
- downgrade;
- suspend;
- billing history;
- payment proof;
- partner billing.

**Status:** PROVISIONAL / FUTURE.

Important principle:

> Active mission-critical assessment must not fail merely because billing service is temporarily unavailable.

Historical Midtrans discussion exists but payment provider must be revalidated before locking.

---

# 35. Platform Owner Recovery

Candidate capabilities:

- tenant management;
- tenant verification;
- package;
- feature flags;
- platform analytics;
- system health;
- support;
- audit;
- abuse/security visibility;
- partner approval;
- moderation;
- platform configuration.

**Status:** LOCKED as role/domain; exact permissions OPEN.

---

# 36. Support / Trust & Safety Recovery

Candidate:

- help center;
- ticket;
- knowledge base;
- tenant support;
- moderation;
- content report;
- partner complaint;
- security incident;
- support access audit.

**Status:** PROVISIONAL.

---


# 36A. RECOVERY-R2.9 Review Outcome — Web-First Delivery, Mobile-First UX & Multi-Platform Readiness

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.9  
**Owner Approval:** APPROVED — ITEM 1 EXPANDED, ALL OTHERS KEPT

Core delivery strategy:

> **WEB-FIRST DELIVERY, MOBILE-FIRST UX, MULTI-PLATFORM ARCHITECTURE**

## R2.9-01 — Website First for Initial Delivery
**Decision:** LOCKED — EXPANDED  
Initial implementation prioritizes a high-quality responsive website because of current development-budget limitations. This is a delivery decision, not a web-only architecture decision.

```text
WEB-FIRST DELIVERY
≠
WEB-ONLY ARCHITECTURE
```

Initial target:
- Android browser
- iPhone/iOS browser
- tablet browser
- desktop/school PC browser

Future expansion:
- Android app
- iOS app
- tablet-optimized/native experiences where justified

Business logic and critical workflows must not be trapped in browser-specific UI code.

## R2.9-02 — iOS, Tablet & PC Supported
**Decision:** LOCKED  
Android is the primary student-device target, while iOS, Android tablets, iPad, Windows PC, and laptops/desktops remain supported targets.

## R2.9-03 — Future Mobile App Must Use Device Capabilities Properly
**Decision:** LOCKED  
A simple wrapped website is not the long-term mobile architecture target. Future mobile apps must be able to use camera, battery, network status, push notifications, secure local storage, app lifecycle, device signals, and location only where justified.

## R2.9-04 — Shared Business Logic
**Decision:** LOCKED  
Use shared backend/domain rules/contracts with platform-specific adapters for Web, Android, and iOS.

## R2.9-05 — Weak Connection / Offline Is Normal
**Decision:** LOCKED  
Relevant features must define ONLINE, WEAK_CONNECTION, OFFLINE, RETRYING, RESYNCING, CONFLICT, and RECOVERED states.

## R2.9-06 — Assessment Requires Dedicated Persistence/Recovery
**Decision:** LOCKED  
Temporary connectivity loss must not automatically cause lost student answers. Exact autosave/offline algorithms remain for later technical discovery.

## R2.9-07 — Device Capability Matrix Mandatory
**Decision:** LOCKED  
Anti-cheating/device capabilities must be classified per Android app, iOS app, mobile browser, desktop browser, and tablet as SUPPORTED, PARTIAL, UNAVAILABLE, or FALLBACK.

## R2.9-08 — Battery Monitoring
**Decision:** LOCKED  
Battery may be used as Exam Device Health where supported. It is an operational signal, not misconduct evidence.

## R2.9-09 — Network Health Monitoring
**Decision:** LOCKED  
Assessment may surface ONLINE, UNSTABLE, RECONNECTING, OFFLINE, and RECOVERED states to students and authorized proctors without making monitoring itself a dependency of answer persistence.

## R2.9-10 — Location/IP Are Signals, Not Absolute Truth
**Decision:** LOCKED  
IP/location/network data may contribute to risk/context evaluation but must not be treated as conclusive proof of physical location.

## R2.9-11 — Push Notifications
**Decision:** LOCKED  
Push notifications are a first-class future mobile capability for exams, assignments, announcements, recruitment/scholarship status, counseling reminders, and security alerts.

## R2.9-12 — App Update Strategy
**Decision:** LOCKED  
Future clients should distinguish SUPPORTED, UPDATE_AVAILABLE, UPDATE_RECOMMENDED, and UPDATE_REQUIRED. Forced updates must not unexpectedly block imminent/active exams without safe fallback.

## R2.9-13 — Pre-Exam Device Compatibility Check
**Decision:** LOCKED  
Students may run a pre-exam readiness check covering OS/browser/app version, camera, storage, network, battery, permissions, and other required capabilities.

## R2.9-14 — Normal Multi-Device, Stricter Exam Policy
**Decision:** LOCKED  
Normal ELLIGBLE usage may allow multiple devices/sessions; Assessment can enforce stricter exam-specific device/session rules.

## R2.9-15 — Mobile Performance Budget
**Decision:** LOCKED  
Future design/architecture must consider initial load, bundle size, memory, battery, network requests, media optimization, lazy loading, realtime subscriptions, background activity, and rendering complexity.

## R2.9-16 — Functional Parity, Not Pixel Parity
**Decision:** LOCKED  
Supported platforms should deliver consistent business outcomes with device-appropriate UI.

## R2.9 Consolidated Result

```text
R2.9-01 Web-First Delivery / Mobile-First UX         → LOCKED — EXPANDED
R2.9-02 iOS / Tablet / PC Support                    → LOCKED
R2.9-03 Proper Future Mobile Integration             → LOCKED
R2.9-04 Shared Business Logic                        → LOCKED
R2.9-05 Weak Network / Offline                       → LOCKED
R2.9-06 Assessment Recovery Strategy                 → LOCKED
R2.9-07 Device Capability Matrix                     → LOCKED
R2.9-08 Battery Monitoring                           → LOCKED
R2.9-09 Network Health                               → LOCKED
R2.9-10 Location / IP as Signals                     → LOCKED
R2.9-11 Push Notifications                           → LOCKED
R2.9-12 Mobile Update Strategy                       → LOCKED
R2.9-13 Pre-Exam Device Check                        → LOCKED
R2.9-14 General vs Exam Device Policy                → LOCKED
R2.9-15 Mobile Performance Budget                    → LOCKED
R2.9-16 Functional Parity / Adaptive UI              → LOCKED
```

---

# 37. Web / Mobile Shared Architecture Recovery

**Status: LOCKED**

Principle:

```text
Shared Domain
Shared Business Rules
Shared Contracts
Shared Backend
↓
Platform-specific presentation/adapters
├── Web
├── Android
├── iOS
└── Tablet behavior
```

Avoid web-only business logic.

---

# 38. Weak Network / Offline Recovery

**Status: LOCKED as engineering concern**

Every relevant feature must define:

```text
Online behavior
Weak-connection behavior
Offline behavior
Retry
Sync
Conflict
User feedback
```

Assessment receives highest priority for recovery design.

---

# 38A. RECOVERY-R2.10 Review Outcome — Architecture, Backend & DevOps Foundation

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.10  
**Owner Approval:** APPROVED — ALL ITEMS KEPT

The Platform Owner approved the complete technical-foundation direction.

---

## R2.10-01 — InsForge-First, Provider-Agnostic

**Decision:** LOCKED

InsForge is the initial backend provider, but ELLIGBLE domain/business logic must not become structurally dependent on InsForge-specific SDK usage throughout the codebase.

Preferred boundary:

```text
Domain / Application
↓
Ports / Repositories / Services
↓
Infrastructure Adapters
↓
InsForge
```

Provider-specific code must remain inside approved infrastructure boundaries so future provider replacement, combination, or specialization does not require a full product rewrite.

---

## R2.10-02 — Modular Monolith as the Starting Architecture

**Decision:** LOCKED

ELLIGBLE should begin as a modular monolith with explicit bounded domains rather than premature microservices.

Candidate bounded domains:

```text
Core
Academic
Learn
Assess
LPTPAT / Track
Care
Parent
Passport
Path
Partner
Alumni
Insight
```

Each domain must have clear ownership, contracts, and dependency rules.

The architecture should remain decomposable so a domain can later be extracted into a separate service if scale, reliability, security, or organizational needs justify it.

Principle:

> **Start operationally simple, preserve structural boundaries.**

---

## R2.10-03 — Assessment Has the Strictest Dependency Boundary

**Decision:** LOCKED — PRIORITY CRITICAL

During active exams, the Assessment Core must not synchronously depend on non-critical domains such as:

```text
Feed / Home enrichment
Path
Partner
General analytics
Billing UI
LPTPAT non-essential processing
Recommendation engines
Optional integrations
```

Mission-critical paths include:

```text
Exam Eligibility
Session Start
Question Delivery
Answer Persistence
Autosave
Reconnect
Submission
Required Security Controls
Audit / Evidence required for exam integrity
```

These paths must have the smallest practical dependency surface.

---

## R2.10-04 — Controlled Shared Database for the Initial Architecture

**Decision:** LOCKED

ELLIGBLE may use a shared PostgreSQL database during the initial modular-monolith phase.

However, shared physical storage does not mean uncontrolled cross-domain ownership.

Each domain must define ownership of:

```text
Tables / schemas where applicable
Write responsibilities
Read contracts
Events
Constraints
Migration ownership
```

A module must not directly mutate another domain's data merely because the tables are accessible.

Cross-domain writes should occur through approved application/domain contracts.

---

## R2.10-05 — Database Changes Must Be Reproducible Through Versioned Migrations

**Decision:** LOCKED

Database changes must be represented through version-controlled migrations or an equivalent reproducible mechanism stored in Git.

Prohibited default behavior:

```text
Manual dashboard schema edit
↓
No migration recorded
↓
Local/spec/backend state becomes inconsistent
```

Required direction:

```text
Design
↓
Migration
↓
Review
↓
Apply to intended environment
↓
Verify actual backend state
↓
Verify application integration
↓
Record Git checkpoint
```

If actual InsForge backend state and repository migration history disagree, the task must enter reconciliation rather than blindly overwriting either side.

---

## R2.10-06 — Separate Environments Before Production Use

**Decision:** LOCKED

Production must not be used as the default experimentation environment.

Target lifecycle:

```text
Local / Development
↓
Testing / Staging
↓
Production
```

Exact InsForge project/environment mechanics will be verified during technical setup.

Rules:

- coding experiments stay outside production;
- migrations are tested before production;
- production secrets remain isolated;
- destructive operations require explicit scope;
- release promotion must be deliberate.

---

## R2.10-07 — Private GitHub Becomes the Technical Source of Truth

**Decision:** LOCKED

After Recovery and the minimum engineering foundation are ready, the clean ELLIGBLE repository should be connected to a private GitHub repository.

GitHub should become the technical Source of Truth for:

```text
Source code
Architecture documentation
Decision records
Migrations
Tests
Build-unit history
Git history
Release checkpoints
```

Chat is not the canonical technical storage location.

---

## R2.10-08 — Continuous Integration Is Required Before Serious Release

**Decision:** LOCKED

Important code changes should eventually pass automated checks such as:

```text
Typecheck
Lint
Unit Tests
Integration Tests
Build
Security checks where applicable
```

Critical user journeys should also receive E2E coverage, especially:

```text
Authentication
Tenant/context switching
Student onboarding
Assessment
Exam submission
Enrollment / transfer
Privileged operations
```

Exact CI provider/workflow remains OPEN until stack selection.

---

## R2.10-09 — Observability Is a Foundation Requirement

**Decision:** LOCKED

ELLIGBLE must be diagnosable without relying on guesswork when a school reports a problem.

Required direction includes:

```text
Structured Logs
Error Tracking
Audit Logs
Performance Signals
Health Monitoring
Tenant-Aware Diagnostics
Assessment-Specific Monitoring
```

Logs must avoid exposing secrets or unnecessary sensitive student data.

Mission-critical Assessment should have dedicated operational visibility.

---

## R2.10-10 — Backup, Restore & Recovery Must Be Designed and Verified

**Decision:** LOCKED

Backup existence alone is not sufficient.

The platform must eventually define:

```text
Backup scope
Backup frequency
Retention
Encryption
Restore process
Restore verification
Recovery objectives
Disaster-recovery procedure
```

Principle:

> **A backup that has never been successfully restored is not a fully verified recovery strategy.**

---

## R2.10-11 — Non-Critical Work Should Be Asynchronous Where Appropriate

**Decision:** LOCKED

Mission-critical transactions should not wait for every downstream consumer.

Example Assessment flow:

```text
Final Exam Submission Persisted Safely
↓
Canonical Result / Event Recorded
↓
Async Processing
├── LPTPAT update
├── Passport update where approved
├── Analytics
└── Notification
```

The submit action should not fail merely because a non-critical downstream processor is temporarily unavailable.

Candidate patterns may include:

```text
Outbox
Queue
Retryable job
Event consumer
Deferred synchronization
```

Exact implementation depends on architecture and InsForge capability verification.

---

## R2.10-12 — Idempotency Is Required for Critical Actions

**Decision:** LOCKED

Weak networks, retries, and duplicate client requests must not produce duplicate business outcomes when only one outcome is valid.

Candidate idempotent operations include:

```text
Exam submission
Participant assignment
Payment initiation/confirmation
Certificate issuance
Application submission
Transfer acceptance
Critical imports
```

Example principle:

```text
Same intended request retried safely
→ one canonical business result
```

---

## R2.10-13 — Feature Flags Are for Controlled Delivery, Not Core-Module Discrimination

**Decision:** LOCKED

Feature flags may be used for:

```text
Pilot
Beta
Staged rollout
Compatibility
Incident mitigation
Security response
Maintenance
Technical experiments with approval
```

They should not become the default mechanism for withholding core school modules from lower-paying schools, because R2.3 established full core-module access as the fairness direction.

---

## R2.10-14 — Secrets Must Never Enter Source Code or Untrusted Contexts

**Decision:** LOCKED

Privileged credentials must not be stored in:

```text
Frontend code
Mobile bundles
Git
Documentation
Screenshots
Prompts
Client logs
```

Sensitive configuration must use approved environment/secret-management mechanisms.

Agents must never solve authentication problems by moving privileged keys into client code.

---

## R2.10-15 — Legacy Implementation Must Be Audited Before Reuse

**Decision:** LOCKED

The old CBT/ELLIGBLE implementation remains a reference source, not a codebase to copy wholesale.

Every relevant legacy component should later receive one classification:

```text
KEEP
PORT
REFACTOR
REWRITE
REFERENCE ONLY
DROP
```

Audit targets include:

```text
Database migrations
Auth
Question Bank
Exam Builder
Participant Assignment
Exam Runtime
Anti-Cheating
Proctoring
UI patterns
Security decisions
Git history
Operational lessons
```

No historical migration should be blindly rerun in the clean backend.

---

## R2.10-16 — Scale-Ready, Not Scale-Premature

**Decision:** LOCKED

ELLIGBLE should not build expensive distributed infrastructure merely to imitate hyperscale architecture before real demand exists.

At the same time, obvious future blockers should be avoided.

Principle:

```text
SIMPLE ENOUGH FOR TODAY
+
BOUNDARIES STRONG ENOUGH FOR TOMORROW
```

This means:

- modular boundaries now;
- measured capacity planning;
- pagination and bounded operations;
- failure isolation;
- observability;
- async processing where valuable;
- migration path toward decomposition when justified.

Infrastructure complexity must be introduced because measurable requirements demand it, not because it is fashionable.

---

## R2.10 Consolidated Result

```text
R2.10-01 InsForge-first / Provider-agnostic          → LOCKED
R2.10-02 Modular Monolith                            → LOCKED
R2.10-03 Assessment Dependency Boundary              → LOCKED — PRIORITY CRITICAL
R2.10-04 Controlled Shared Database                  → LOCKED
R2.10-05 Versioned Migrations                        → LOCKED
R2.10-06 Environment Separation                      → LOCKED
R2.10-07 Private GitHub Source of Truth              → LOCKED
R2.10-08 Continuous Integration                      → LOCKED
R2.10-09 Observability                               → LOCKED
R2.10-10 Backup / Restore / Recovery                 → LOCKED
R2.10-11 Asynchronous Processing                     → LOCKED
R2.10-12 Idempotency                                 → LOCKED
R2.10-13 Feature Flag Purpose                        → LOCKED
R2.10-14 Secret Management                           → LOCKED
R2.10-15 Legacy Audit                                → LOCKED
R2.10-16 Scale-Ready / Not Scale-Premature           → LOCKED
```

These decisions supersede conflicting architecture assumptions.

---

# 39. Legacy Project Recovery

Legacy project provides reference for:

- Auth/audit;
- master data;
- teaching assignment;
- question bank;
- exam builder;
- immutable publish snapshot;
- public exam ID;
- participant assignment;
- anti-cheating concepts;
- proctoring;
- applied migrations;
- Git history;
- security lessons;
- UI prototypes.

**Status: LEGACY**

Rule:

> Legacy implementation is reference material, not automatically reusable code.

Each component will later receive:

```text
KEEP
PORT
REFACTOR
REWRITE
REFERENCE ONLY
DROP
```

---

# 40. Known Legacy Checkpoint

Recovered historical checkpoint:

- participant-assignment work had been developed in the previous project;
- a historical participant-assignment migration had already been applied in that legacy environment;
- visual participant management had already been explored;
- Phase 6 verification was not fully complete.

**Status: LEGACY**

No legacy migration should be rerun in the new clean backend without a clean rebuild specification.

---

# 41. UI Legacy Lessons

Recovered lesson:

Participant Assignment UI in the legacy implementation was considered too utilitarian/plain-admin and should evolve toward:

- modern education SaaS;
- compact exam context;
- polished toolbar;
- cards/table based on device;
- sticky/bulk action pattern;
- better hierarchy;
- responsive mobile cards;
- centralized theming.

**Status:** LEGACY lesson / PROVISIONAL design direction.

---

# 42. Design System Recovery

Candidate:

```text
Design tokens
Color tokens
Typography
Spacing
Radius
Elevation
Iconography
Component library
Responsive rules
Role-based shell
Module accents
Accessibility
Loading/empty/error states
```

**Status:** PROVISIONAL.

Brand alignment should be centralized, not scattered across individual components.

---

# 43. Security Recovery

Candidate baseline:

- tenant isolation;
- authentication security;
- session security;
- RBAC;
- privileged action verification;
- student data privacy;
- encryption;
- consent;
- audit;
- secret management;
- partner integration security;
- abuse prevention;
- content moderation;
- incident response;
- security testing.

**Status:** LOCKED as mandatory engineering domain; detailed implementation OPEN.

---


# 43A. RECOVERY-R2.11 Review Outcome — Security, Privacy & Trust

**Review Status:** REVIEWED & LOCKED  
**Decision Round:** RECOVERY-R2.11  
**Owner Approval:** APPROVED — ALL ITEMS KEPT

The Platform Owner approved the complete security, privacy, fraud-control, audit, and trust direction.

---

## R2.11-01 — Least-Privilege Authorization

**Decision:** LOCKED

ELLIGBLE must enforce least privilege.

Access decisions should consider:

```text
Identity
+ Active Context
+ Tenant
+ Membership
+ Assignment
+ Capability
+ Resource
+ Scope
+ Time
+ Policy
```

A role name alone must not automatically grant broad access.

---

## R2.11-02 — Student Data Is Private by Default

**Decision:** LOCKED

Private student data must not automatically be visible to:

```text
Partners
Other schools
Other students
Other parents
Unrelated alumni
Unrelated internal staff
```

Access must be justified by:

```text
authorized purpose
permission
scope
consent where required
auditability
```

---

## R2.11-03 — Passport Uses Granular Visibility

**Decision:** LOCKED

Passport must support more granular visibility than simple PUBLIC/PRIVATE.

Candidate visibility scopes:

```text
PRIVATE
SCHOOL
GUARDIAN
SELECTED_PARTNER
APPLICATION_SPECIFIC
VERIFIED_CONNECTION
PUBLIC_PROFILE
```

Final visibility names and policy semantics remain subject to dedicated Passport discovery.

---

## R2.11-04 — Partner Access Is Consent-Based

**Decision:** LOCKED

Partner access to Passport/student data must follow a controlled consent-aware flow.

Example:

```text
Student applies to Opportunity X
↓
ELLIGBLE shows requested data
↓
Student reviews and consents
↓
Partner receives only approved data
↓
Access is logged
↓
Access expires/revokes according to policy
```

A previous application must not create unrestricted permanent Passport access.

---

## R2.11-05 — Purpose Limitation

**Decision:** LOCKED

Data shared for one approved purpose must not automatically be reused for another unrelated purpose.

Example:

```text
Recruitment for Vacancy A
≠
Permission for unrelated marketing
```

The system should be able to record:

```text
who accessed
what data
why
when
under which authorization/consent
```

---

## R2.11-06 — Sensitive Audit Logs Are Append-Oriented

**Decision:** LOCKED

Sensitive events must produce durable audit records.

Candidate events:

```text
Result correction
Passport verification
Permission change
Partner data access
Exam termination
Support tenant access
Identity merge
Sensitive export
Evidence access
Privilege escalation
Consent change
```

Normal operational users must not be able to silently rewrite audit history.

---

## R2.11-07 — Assessment Evidence Receives Special Protection

**Decision:** LOCKED

Assessment evidence such as:

```text
Snapshots
Violation events
Device/network signals
Proctor actions
Lock/terminate events
Security logs
```

must be treated as protected evidence, not ordinary media/files.

Required dimensions include:

```text
ownership
retention
access policy
integrity
provenance
audit
review/appeal
```

---

## R2.11-08 — Fraud / Risk Signals Do Not Automatically Prove Misconduct

**Decision:** LOCKED

Risk engines may produce levels such as:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

but:

> **Risk signal ≠ proven fraud or cheating.**

Important enforcement must consider:

```text
evidence
context
human review where appropriate
appeal/review process
audit
```

This principle applies to:

```text
Assessment
Partner abuse
Privileged staff activity
Passport manipulation
Suspicious login
Data export anomalies
```

---

## R2.11-09 — Maker-Checker for High-Risk Actions

**Decision:** LOCKED

Selected sensitive actions may require dual control:

```text
User A requests
↓
User B approves
↓
System executes
↓
Audit records both identities
```

Candidate cases:

```text
Large data deletion
Tenant ownership transfer
High-impact privilege escalation
Verified Passport override/correction
Selected evidence override/deletion
Other irreversible high-risk actions
```

Final action list remains subject to Security discovery.

---

## R2.11-10 — Support Must Never Request User Passwords

**Decision:** LOCKED

ELLIGBLE Support must not require users to disclose their passwords.

Future support-access patterns may use:

```text
Authorized support session
Reason
Scope
Expiry
Audit
Visible context indicator where appropriate
```

---

## R2.11-11 — Data Deletion and Retention Must Be Distinguished

**Decision:** LOCKED

The platform must distinguish:

```text
Account deletion
Membership termination
Data anonymization
Academic/legal retention
Assessment retention
Audit retention
Passport deletion
Evidence retention
```

Not all data can or should be treated with one deletion rule.

Final retention periods require dedicated legal/privacy discovery.

---

## R2.11-12 — Security Incident Response Is Required

**Decision:** LOCKED

ELLIGBLE must define an incident-response lifecycle.

Candidate flow:

```text
Detect
↓
Triage
↓
Contain
↓
Revoke / Isolate
↓
Preserve Evidence
↓
Investigate
↓
Recover
↓
Notify required parties where applicable
↓
Post-Incident Review
```

Candidate incident types:

```text
Account takeover
Tenant data leak
Partner abuse
Suspicious export
Credential exposure
Assessment attack
Privilege abuse
Evidence tampering attempt
```

---

## R2.11-13 — Rate Limiting & Abuse Prevention

**Decision:** LOCKED

Sensitive/high-abuse endpoints must receive risk-appropriate protection.

Candidate areas:

```text
Login
Password reset
OTP / verification
Search
Bulk import
Application submission
Exam join
Partner actions
Public forms
Privileged APIs
```

Exact limits remain environment/use-case specific.

---

## R2.11-14 — Privacy Is Part of Acceptance Criteria

**Decision:** LOCKED

A Build Unit touching personal/sensitive data is not complete solely because functional tests pass.

Relevant acceptance criteria must ask:

```text
Who can read?
Who can write?
Which tenant owns the data?
Is consent required?
Is access audited?
How long is it retained?
Can sensitive values leak into logs?
What happens on cross-tenant access attempts?
How is data revoked/expired?
```

Privacy and authorization checks become part of Definition of Done for applicable Build Units.

---

## R2.11-15 — Trust Must Be Designed Across Product Domains

**Decision:** LOCKED — EXPANDED

Security/privacy/trust are not isolated to one Security module.

They must influence:

```text
Identity
Academic Core
Learn
Assessment
LPTPAT
Passport
Path
Partner
Parent
Care
Alumni
Insight
Support
Platform Operations
```

The final security architecture should centralize cross-cutting controls while preserving bounded-domain ownership.

---

## R2.11 Consolidated Result

```text
R2.11-01 Least Privilege                        → LOCKED
R2.11-02 Student Data Private by Default        → LOCKED
R2.11-03 Granular Passport Visibility           → LOCKED
R2.11-04 Consent-Based Partner Access           → LOCKED
R2.11-05 Purpose Limitation                     → LOCKED
R2.11-06 Append-Oriented Audit                  → LOCKED
R2.11-07 Protected Assessment Evidence          → LOCKED
R2.11-08 Risk Signal ≠ Proven Misconduct        → LOCKED
R2.11-09 Maker-Checker                          → LOCKED
R2.11-10 No Password Sharing with Support       → LOCKED
R2.11-11 Deletion vs Retention                  → LOCKED
R2.11-12 Incident Response                      → LOCKED
R2.11-13 Rate Limiting / Abuse Prevention       → LOCKED
R2.11-14 Privacy Acceptance Criteria            → LOCKED
R2.11-15 Cross-Domain Trust                     → LOCKED
```

These decisions supersede conflicting security/privacy assumptions.

---

# 44. DevOps / Engineering Foundation Recovery

Candidate requirements before application build:

```text
Development environment
Testing environment
Production environment
Secret management
Logging
Error monitoring
Backup
Recovery
Migration strategy
Rollback strategy
CI checks
Testing strategy
Release strategy
Git workflow
Documentation continuity
```

**Status:** LOCKED as required foundation; provider/tool selection may remain OPEN.

---

# 45. Agent Skills Recovery

Previously identified categories:

- InsForge integrations;
- UI/design taste;
- frontend engineering;
- TypeScript/React best practices depending final stack;
- database/PostgreSQL;
- security;
- testing;
- Playwright/E2E;
- Git/GitHub;
- future mobile skill;
- custom ELLIGBLE architecture/security/testing/domain skills.

**Status:** PROVISIONAL.

Do not install skills randomly before stack and architecture are locked.

---

# 46. Custom ELLIGBLE Agent Skills — Candidate

Potential future custom skills:

```text
elligble-architect
elligble-ui-guardian
elligble-database-guardian
elligble-security-guardian
elligble-assess
elligble-testing
elligble-mobile
elligble-release-guardian
```

**Status:** FUTURE / PROVISIONAL.

---

# 47. Source of Truth Strategy

**Status: LOCKED**

Critical context must not live only in chat.

Target documentation:

```text
MASTER_CONTEXT
MASTER_BLUEPRINT
DECISION_LOG
CURRENT_STATE
DOMAIN SPECS
MODULE SPECS
BUILD UNIT SPECS
ARCHITECTURE DECISION RECORDS
TEST / QUALITY GATES
```

GitHub will become technical Source of Truth after repository is intentionally connected.

---

# 48. Build Unit ID Strategy

**Status: PROVISIONAL, recommended**

Potential ID model:

```text
CORE-AUTH-001
ACAD-CLASS-001
HOME-FEED-001
PASS-PROFILE-001
CONN-NET-001
LEARN-ASSIGN-001
ASM-QBANK-001
ASM-EXAM-001
ASM-PART-001
ASM-RUNTIME-001
PROCTOR-ANTI-001
TRACK-PROG-001
CARE-CASE-001
PARENT-DASH-001
PATH-COLLEGE-001
PARTNER-OPP-001
ALUMNI-NET-001
INSIGHT-PLATFORM-001
```

Final naming convention needs governance review.

---

# 49. Discovery Backbone

Recovered baseline discovery sequence:

```text
00 Governance
01 Vision, Problem, Product Boundary
02 Business, Legal, Operations
03 Organization, Tenant, Identity, RBAC
04 Indonesian Senior-Secondary Academic Structure
05 User Journeys & App Experience
06 Mobile / Multi-Device Strategy
07 Technical Architecture & DevOps Foundation
08 Security & Trust
09 Profile, Passport, Home, Network
10 Learn
11 Assess
12 Proctoring & Anti-Cheating
13 Track, Care, Parent
14 Future Path, Partner, Merchant
15 Alumni & Impact
16 Insight, Billing, Support, Launch
```

**Status:** LOCKED as current discovery backbone unless a later governance decision changes it.

---

# 50. Discovery Template

Every small discovery unit should answer:

```text
1. Objective
2. Problem
3. Actors
4. Scope
5. Out of Scope
6. Business Rules
7. Permissions
8. Required Data
9. Main Flow
10. Alternative Flow
11. Error Conditions
12. Notifications
13. Search / Filter / Reporting
14. Privacy
15. Security
16. Web Behavior
17. Mobile Behavior
18. Weak Connection Behavior
19. Integration Dependencies
20. Acceptance Criteria
21. Test Scenarios
22. Open Decisions
23. Risks
24. Future Considerations
```

Then Engineering Specification adds:

```text
Domain Ownership
Entities
Database Tables
API Contract
Validation
Authentication
Authorization
Tenant Isolation
Events
Audit
Allowed Files
Forbidden Areas
Migration
Performance
Concurrency
Idempotency
Retry
Offline
Logging
Observability
Provider Dependencies
Tests
Terminal Verification
Rollback
```

---

# 51. Explicitly Open High-Impact Decisions

The following should NOT be silently assumed during build:

## Product / Business
- final pricing;
- package structure;
- trial;
- partner monetization;
- transaction/referral model;
- white-label depth;
- custom domain policy.

## Identity
- login identifiers;
- MFA;
- account creation model;
- support impersonation;
- alumni transition rules.

## Home / Social
- student posting;
- public visibility;
- feed ranking;
- moderation;
- interaction with external parties.

## Passport
- portable records;
- verification;
- partner access;
- consent model.

## Learn
- final assignment types;
- plagiarism;
- group assignment;
- peer review.

## Assess
- final question types;
- final autosave algorithm;
- offline exam policy;
- device eligibility;
- anti-cheating enforcement thresholds;
- camera/snapshot policies;
- false-positive workflow.

## Parent
- anti-cheating visibility;
- private student information;
- communication limits.

## Path
- recommendation algorithm;
- readiness scoring;
- AI usage;
- matching model.

## Partner
- partner access to student profiles;
- lead sharing;
- contact rules;
- marketplace/payment flow.

## Mobile
- final mobile framework;
- app/web feature parity;
- native anti-cheating capabilities;
- iOS release timing.

## Infrastructure
- final frontend stack;
- mobile stack;
- CI/CD;
- analytics;
- monitoring;
- search provider;
- notification provider;
- payment provider;
- AI provider.

---

# 52. Rejected / Superseded Directions

Current baseline rejects or supersedes:

1. ELLIGBLE as a single-school product.
2. SMA N 1 Mlati as the product identity.
3. SMP/MTs as target tenant.
4. University/S1/S2/S3 as core academic tenant.
5. Web-only architecture.
6. Backend code tightly coupled everywhere to InsForge SDK.
7. Building the entire platform in one long AI execution.
8. Declaring a module DONE without terminal verification.
9. Treating frontend permission hiding as tenant security.
10. Assuming all anti-cheating capabilities work identically across Android, iOS, web, tablet, and PC.
11. Copying the legacy repo wholesale into the clean rebuild.

---

# 53. Recovery Confidence

This Recovery Pass R1 contains:

```text
HIGH CONFIDENCE
→ decisions repeatedly confirmed in current planning

MEDIUM CONFIDENCE
→ historical ideas recovered but still need discovery

LOW / OPEN
→ assumptions or feature ideas that require explicit Platform Owner decision
```

No PROVISIONAL or OPEN item may silently become implementation architecture.

---

# 54. Next Recovery Actions

Before proceeding to detailed governance files:

## RECOVERY-R2

Review this document section-by-section with the Platform Owner.

For each item:

```text
KEEP
CHANGE
EXPAND
DEFER
REJECT
UNKNOWN
```

## RECOVERY-R3

Add missing historical feature ideas from:

- legacy repository;
- legacy docs;
- historical screenshots;
- previous masterplan;
- migration history;
- UI prototypes;
- previous ChatGPT discussions;
- previous Antigravity outputs.

## RECOVERY-R4

Resolve contradictions.

## RECOVERY-R5

Freeze the recovery baseline.

Only after that should detailed discovery proceed.

---

# 55. Current Project State

```text
PROJECT:
ELLIGBLE Clean Rebuild

CURRENT PHASE:
Recovery & Discovery

APPLICATION CODING:
NOT STARTED

BACKEND INITIALIZATION:
NOT STARTED

INSFORGE:
Selected as initial backend direction,
but new clean backend resources are NOT yet initialized.

GITHUB REMOTE:
NOT YET CONNECTED for clean rebuild

LOCAL REPOSITORY:
Initialized

ACTIVE GOVERNANCE:
GOV-00.01

ACTIVE RECOVERY:
REC-00.00

NEXT:
Review REC-00.00 with Platform Owner
```

---

# 56. Recovery Golden Rule

> **The purpose of recovery is not to preserve every old idea. The purpose is to ensure no useful idea is forgotten and no outdated idea is silently carried into the clean rebuild.**


# R3 — CONSOLIDATION & GAP AUDIT

**Status:** STARTED  
**Purpose:** Consolidate all Recovery decisions, identify remaining OPEN / PROVISIONAL / FUTURE / LEGACY / conflict items, and prepare the Recovery Index for final freeze before detailed Discovery.

R3 does not introduce new product domains unless a true missing dependency is discovered.

Primary checks:

```text
1. OPEN decisions
2. PROVISIONAL decisions
3. FUTURE decisions
4. LEGACY items still requiring audit
5. Contradictions across domains
6. Duplicate concepts / naming collisions
7. Missing cross-domain contracts
8. Legal / privacy unresolved allocation
9. Technical provider / integration dependencies
10. Build-readiness blockers for Discovery
```

The final Recovery Index will be frozen only after these checks are completed and remaining unresolved items are explicitly routed to the appropriate Discovery document.


## R3.1 — Status Normalization & Supersession Audit

**Review Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

### R3.1-01 — Newer Reviewed Decisions Supersede Earlier Inventory
**Decision:** LOCKED

```text
RECOVERY INVENTORY / OLD PROVISIONAL / OLD OPEN
↓ if reviewed
R2 / R3 REVIEW OUTCOME
↓
NEWER REVIEWED DECISION IS CANONICAL
```

Historical inventory may remain as evidence, but must not override later reviewed decisions.

### R3.1-02 — Home / Feed Social Direction
**Decision:** SUPERSEDED / REJECTED AS PRIMARY DIRECTION

Canonical direction:

```text
HOME
= Operational Command Center
≠ Social Feed
```

Old questions about unrestricted posting, social-feed ranking, public-feed mechanics, and similar assumptions are no longer active `OPEN` items.

### R3.1-03 — Connect as Follower / Friend Graph
**Decision:** SUPERSEDED / REJECTED

Canonical direction:

```text
CONNECT
= Verified Relationship & Outcome Tracking
```

Rejected as primary product direction:

```text
Follower Graph
Free Friend System
Unrestricted Network Discovery
Social-Network Mechanics
```

### R3.1-04 — Profile / Passport Old Provisional Bundle
**Decision:** SUPERSEDED BY R2 PROFILE & PASSPORT DECISIONS

Canonical:

```text
PROFILE
≠
PASSPORT
```

Exact presentation fields remain for Discovery; domain separation is already LOCKED.

### R3.1-05 — Question Bank Old OPEN Items
**Decision:** NORMALIZED

Core Question Bank direction is already LOCKED by R2.14.

Remaining detailed Discovery items may include:

```text
Future Question Types
Formula Editor
Audio / Video Implementation
Detailed Review Workflow
```

but Question Bank as a whole is no longer an OPEN product concept.

### R3.1-06 — Anti-Cheating Product Requirement vs Platform Feasibility
**Decision:** LOCKED SPLIT

```text
PRODUCT REQUIREMENT
→ LOCKED

PLATFORM / DEVICE FEASIBILITY
→ PROVISIONAL UNTIL CAPABILITY DISCOVERY
```

Applies to:

```text
Fullscreen
Screenshot
Camera
DevTools Signals
Copy / Paste Controls
Battery
Location
Device Signals
```

### R3.1-07 — Track / Care / Parent / Path / Partner / Alumni Old Status
**Decision:** SUPERSEDED BY R2.16–R2.21

Historical notes remain reference evidence only.

### R3.1-08 — Notifications / Messaging / Search Old Status
**Decision:** SUPERSEDED BY R2.22

Technical implementation details remain Discovery work; product boundaries are LOCKED.

### R3.1-09 — Billing / Platform Owner / Support Old Status
**Decision:** SUPERSEDED BY R2.23–R2.24

Genuine remaining OPEN items include:

```text
Final Pricing
Final SLA
Success-Fee Model
Detailed Commercial Contract Rules
```

### R3.1-10 — Final Pricing
**Decision:** OPEN — DEFER TO BUSINESS MODEL DISCOVERY

### R3.1-11 — Success Fee / Placement Revenue
**Decision:** OPEN / FUTURE — DEFER

### R3.1-12 — Controller / Processor Legal Allocation
**Decision:** OPEN — MANDATORY LEGAL / PRIVACY DISCOVERY BEFORE PRODUCTION

### R3.1-13 — Final Retention Periods
**Decision:** OPEN — LEGAL / DATA GOVERNANCE DISCOVERY

### R3.1-14 — Feedback & Support Routing / SLA Detail
**Decision:** PROVISIONAL

Canonical requirement is LOCKED:

```text
Every User Has Help & Feedback
Context-Aware Routing
School ↔ ELLIGBLE Escalation
```

Detailed L1/L2 rules, ownership, response targets, and closure rules remain Discovery work.

### R3.1-15 — Design System Detail
**Decision:** PROVISIONAL

A separate Design System document is mandatory.

Detailed colors, typography, spacing, radius, elevation, tokens, dark/light behavior, iconography, motion, and component rules remain Design System Discovery.

### R3.1-16 — Final Technical Stack Detail
**Decision:** PROVISIONAL

Already LOCKED:

```text
Web-First Delivery
Mobile-First UX
Multi-Platform-Ready
InsForge-First / Provider-Agnostic
Modular Monolith Initially
Git Migrations
Ports / Adapters
```

Detailed implementation technologies remain Architecture Discovery.

### R3.1-17 — Agent Skills
**Decision:** PROVISIONAL

Preferred sequence:

```text
Discovery
↓
Architecture
↓
Final Stack
↓
Required Agent Skills
```

Do not install broad skills prematurely.

### R3.1-18 — Build Unit ID Strategy
**Decision:** PROVISIONAL

`One Build Unit per agent execution` remains LOCKED.

Naming/ID taxonomy may be finalized after domain map and architecture are frozen.

### R3.1-19 — FUTURE Has a Canonical Meaning
**Decision:** LOCKED

```text
FUTURE
=
VALID PRODUCT DIRECTION
BUT OUT OF CURRENT BASELINE
AND MUST NOT BE BUILT
WITHOUT EXPLICIT FUTURE BUILD DECISION
```

### R3.1-20 — Global AI Rule
**Decision:** LOCKED

```text
AI FEATURES
→ FUTURE
→ OPTIONAL
→ NON-BLOCKING
→ NO BASELINE DEPENDENCY
→ NO PAID AI REQUIRED
```

Domain-specific AI references inherit this rule.

### R3.1-21 — Legacy CBT Is Reference, Not Architecture Authority
**Decision:** LOCKED

Legacy components are audited as:

```text
KEEP
PORT
REFACTOR
REWRITE
REFERENCE ONLY
DROP
```

No old code, schema, migration, or implementation automatically overrides newer Recovery / Discovery / Blueprint decisions.

### R3.1-22 — Canonical Decision Hierarchy
**Decision:** LOCKED

```text
1. LOCKED R2 / R3 DECISION
↓
2. DISCOVERY DECISION
↓
3. MASTER BLUEPRINT
↓
4. ARCHITECTURE / ADR
↓
5. BUILD UNIT SPEC
↓
6. IMPLEMENTATION
```

Historical inventory, old provisional notes, and old chat assumptions cannot override newer canonical decisions.

### R3.1 Consolidated Result

```text
Supersession Rule                         → LOCKED
Home as Operational Command Center       → LOCKED
Social Feed Direction                    → REJECTED / SUPERSEDED
Follower / Friend Graph                  → REJECTED / SUPERSEDED
Profile ≠ Passport                       → LOCKED
Question Bank Core Direction             → LOCKED
Anti-Cheating Requirement                → LOCKED
Anti-Cheating Platform Feasibility       → PROVISIONAL
Track/Care/Parent/Path/Partner/Alumni     → R2 CANONICAL
Notifications/Messaging/Search           → R2 CANONICAL
Billing/Platform/Support                 → R2 CANONICAL
Final Pricing                            → OPEN
Success Fee                              → OPEN / FUTURE
Controller / Processor Allocation        → OPEN
Retention Periods                        → OPEN
Feedback Routing / SLA Detail            → PROVISIONAL
Design System Detail                     → PROVISIONAL
Final Technical Stack Detail             → PROVISIONAL
Agent Skills                             → PROVISIONAL
Build Unit ID Strategy                   → PROVISIONAL
FUTURE Semantics                         → LOCKED
Global AI Rule                           → LOCKED
Legacy CBT Authority                     → REFERENCE ONLY unless reviewed
Decision Hierarchy                       → LOCKED
```

---



## R3.2 — Contradiction & Naming Audit

**Review Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

### Canonical Naming Policy

```text
CANONICAL TERM
= official domain / architecture meaning

UI LABEL
= user-facing wording that may vary by role/language

LEGACY TERM
= historical reference only unless explicitly re-approved
```

### Locked Normalizations

```text
Home                  → Operational Command Center
Feed                  → SUPERSEDED as primary module

Connect                → Verified Connection
Follower / Friend      → REJECTED as primary graph

Organization           → General organizational entity
Tenant                 → School operational/data-isolation boundary
Organization Group     → Parent/group entity over multiple organizations/tenants

Person                 → Global human identity
User Account           → Authentication/access account
Membership             → Person ↔ Organization/Tenant relationship
Assignment             → Contextual duty/position
Capability             → Allowed action
Role                   → Avoid as catch-all technical concept

School Admin            → UX/general operational term only
School Operator         → Canonical assignment
Principal               → Canonical assignment

Guardian                → Canonical relationship/access concept
Parent                  → Product/UI working label

Alumni                  → Existing Person lifecycle/context, not new identity

Academic Group / Rombel → Student enrollment grouping
Learning Classroom      → Subject + Academic Group + Teacher + Period
Exam Room               → Assessment operational room
Student                 → Person/member
Exam Participant        → Assignment to an exam
Exam Attempt            → One exam attempt
Exam Session            → Runtime/device session

Secure Assessment       → Canonical bounded domain
Assess                  → Product module label
CBT                     → Narrower/historical delivery terminology

Assessment Type         → Taxonomy/category
Exam Instance           → Actual scheduled assessment

Question Bank Item      → Mutable source item
Exam Question Snapshot  → Immutable published exam copy

Teacher                 → Teaching assignment
Proctor                 → Exam supervision assignment

Violation Event         → Observed event
Risk Signal             → Interpreted signal
Incident                → Reviewable case
Cheating Decision       → Authorized final decision where policy applies

Track                   → Canonical academic tracking workspace
LPTPAT                  → Historical conceptual lineage, not standalone module

Early Warning           → Track signal
Care Case               → Authorized support/counseling case
Care                    → Support/counseling/intervention
Discipline              → Conduct/rule-enforcement domain

Profile                 → Current presentation/self-description
Portfolio               → Artifact/workbench collection
Passport                → Portable trusted/verified developmental record
Application Snapshot    → Immutable data shared for a specific application

Path                    → Student planning/bridging engine
Opportunity             → External/internal offering
Goal                    → High-level direction
Target                  → Concrete destination
Action                  → Step toward target
Readiness               → Preparedness
Eligibility             → Formal requirement satisfaction
Relevant                → Contextual fit
Recommended             → Reserved for explicit defensible methodology

Partner Organization    → Ecosystem organization
Merchant                → Commercial partner subtype
Partner Staff           → Person working in partner organization
Opportunity Provider    → Organization providing opportunity

Application             → Student application to opportunity
Verified Connection     → Real verified relationship
Outcome                 → Actual result/event

Reminder                → Scheduled trigger
Notification            → Delivery mechanism
Announcement             → Authored information/content
Message                 → Contextual conversation
Support Case             → Structured operational support workflow
Feedback                 → Suggestion/experience/product input

Tenant Status            → Operational tenant state
Subscription Status      → Commercial state
Support Case             → User/customer request
Platform Incident        → Service/operational failure

PLATFORM_OWNER           → Canonical top governance identity
PLATFORM_STAFF           → Scoped internal operators
SUPER_ADMIN              → LEGACY / rejected for new architecture
```

### Canonical Technical Naming

Internal code/database/API terminology should use stable canonical English terms such as:

```text
tenant
person
membership
guardian
assessment
exam_attempt
exam_session
passport_record
opportunity
application
connection
outcome
support_case
```

UI language remains Indonesian for the Indonesian school product.

Changing UI copy must not force renaming canonical entities.

### Auto-Normalization Rule

**Decision:** LOCKED

In future ELLIGBLE conversations and artifacts:

```text
If the Platform Owner uses an old / ambiguous / superseded term
↓
Normalize it automatically to the newest canonical term
↓
Preserve the user's intent
↓
Briefly explain only when the distinction affects architecture,
permissions, schema, workflow, or product decisions
```

Newer canonical decisions override:

```text
Old Recovery Inventory
Old Provisional Notes
Legacy CBT Terminology
Earlier Chat Assumptions
```

unless the Platform Owner explicitly makes a new decision that supersedes the canonical one.

### Canonical Top-Level Domain Map

```text
ELLIGBLE
│
├── Shared Platform Core
│   ├── Identity
│   ├── Organization / Tenant
│   ├── Access Control
│   ├── Notification
│   ├── Messaging
│   ├── Search
│   ├── Feedback & Support
│   ├── Audit
│   └── Privacy / Trust / Security
│
├── School Operating System
│   ├── Academic Core
│   ├── Learn
│   ├── Student Administration
│   ├── Parent / Guardian
│   ├── Care
│   └── School Insight
│
├── Secure Assessment
│   ├── Question Bank
│   ├── Exam Builder
│   ├── Participant Management
│   ├── Exam Runtime
│   ├── Attempt / Session
│   ├── Autosave / Recovery
│   ├── Scoring
│   ├── Proctoring
│   ├── Anti-Cheating
│   └── Evidence
│
├── Track
│   ├── Academic Progress
│   ├── Early Warning
│   ├── Targets / Follow-Up
│   └── Portfolio Workbench
│
├── Passport
├── Path
│
├── Partner & Opportunity Ecosystem
│   ├── Partner Organization
│   ├── Opportunity
│   ├── Application
│   ├── Verified Connection
│   └── Outcome
│
└── Alumni & Impact
```

### R3.2 Result

**Decision:** LOCKED

The naming/contradiction layer is now canonical for Recovery and must be used as the default vocabulary in Discovery, ERD, API contracts, architecture, Build Units, and implementation.

---



## R3.3 — Cross-Domain Contract & Dependency Audit

**Review Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

### Core Contract Rule
**Decision:** LOCKED

```text
ONE DOMAIN OWNS THE TRUTH
+
OTHER DOMAINS USE EXPLICIT CONTRACTS
+
MINIMUM NECESSARY DATA
+
NO SILENT CROSS-DOMAIN WRITE
+
NO PRIVACY LEAKAGE
+
ASSESSMENT FAILURE ISOLATION
```

### Canonical Ownership

```text
Identity
→ Person
→ User Account
→ Authentication / Session Identity

Organization / Tenant
→ Organization
→ Tenant
→ Membership
→ Organization Relationships

Academic Core
→ Academic Year / Period
→ Grade Level / Program
→ Academic Group / Rombel
→ Subject
→ Enrollment
→ Teaching Assignment
→ Schedule
→ Attendance Baseline

Learn
→ Learning Classroom
→ Material
→ Assignment
→ Submission
→ Feedback
→ Learning Progress

Secure Assessment
→ Exam
→ Participant
→ Attempt
→ Session
→ Answer
→ Submission
→ Score
→ Violation / Evidence
→ Proctor Incident

Track
→ Academic Progress
→ Early Warning
→ Academic Follow-Up

Care
→ Care Case
→ Counseling Session
→ Intervention
→ Referral
→ Follow-Up

Passport
→ Passport Record
→ Provenance / Verification

Path
→ Goal
→ Target
→ Action Plan
→ Readiness

Partner & Opportunity Ecosystem
→ Partner Organization
→ Opportunity
→ Application
→ Verified Connection

Alumni / Outcome
→ Outcome
→ Alumni Transition / Impact

Notification
→ Notification Delivery Records

Feedback & Support
→ Support Case
→ Feedback Record

Billing
→ Subscription / Commercial State
```

### Locked Cross-Domain Contracts

#### Learn → Track
Finalized/derived learning progress may flow to Track.

Track does not edit Learn submissions directly.

#### Assess → Track
Only finalized/approved Assessment results flow to Track.

Flow is asynchronous and must not block submission.

Raw anti-cheating evidence does not flow into Track.

#### Track → Care
Early Warning is a Track signal.

Care Case is created only through an authorized referral flow.

Only minimum necessary referral context may be shared.

Care returns safe workflow status, not private counseling notes.

#### Track → Passport
Track does not dump all academic activity into Passport.

Only meaningful, portable, appropriate, verified/approved records may become Passport records.

#### Assess → Passport
Routine exams do not automatically become Passport entries.

Only selected significant/standardized/credential-like results may be represented, with provenance.

Passport never consumes raw exam answers.

#### Passport → Path
Path may read selected authorized Passport records for readiness/requirement matching.

Path cannot edit Passport records.

#### Track → Path
Path may consume selected academic signals from Track through explicit contracts.

Private Care data is excluded.

#### Parent / Guardian
Parent Portal is a projection over authorized data from other domains.

Parent does not own or directly modify academic truth.

Parent interaction with Care occurs only through Care workflows.

#### Path → Opportunity
Path consumes Opportunity data; it does not own Opportunity.

Matching produces derived results and does not modify Track or Passport.

#### Application Boundary
Application is a distinct record created through explicit student action.

Partner access uses an application-specific snapshot, not unrestricted live Passport.

Passport changes after application do not silently mutate the historical application snapshot.

#### Partner → Passport
Partner cannot freely edit Passport.

Partner may only issue/verify approved credentials or confirm outcomes through controlled workflows.

#### Application → Connection → Outcome
Application does not automatically create Verified Connection.

Verified Connection does not automatically create Outcome.

Important outcomes may require confirmation/review.

#### Alumni
Alumni continues using the same Passport and Path.

No duplicate alumni-specific Passport/Path identity is created.

Schools receive only purpose-limited alumni outcome information.

#### Notification
Source domains emit minimum safe event/payload data.

Notification does not own business workflow state.

#### Search
Search is a derived projection/index.

Authorization is always rechecked against the source domain when opening a resource.

#### Feedback & Support
Support owns support-case data, not source-domain truth.

Any correction must use the authorized source-domain workflow.

Care/private data access is default-deny and requires exceptional scoped authorization when necessary.

#### Insight
Insight consumes derived/aggregated data.

Insight is never master data and cannot directly correct source records.

Assessment analytics remain asynchronous.

#### Billing
Billing may control commercial entitlement/state only.

Billing cannot delete academic records, Passport, or interrupt active Assessment persistence/submission.

### Shared Database Rule
**Decision:** LOCKED

ELLIGBLE may start with:

```text
ONE POSTGRES DATABASE
+
MODULAR MONOLITH
+
STRICT LOGICAL DOMAIN OWNERSHIP
```

A shared database does not mean shared ownership.

Cross-domain foreign keys may be used selectively, but the final FK/event strategy remains Architecture Discovery work.

### Cross-Domain Write Rule
**Decision:** LOCKED

Allowed patterns:

```text
Domain Service Call
Application Service
Published Event
Command
Approved Integration Contract
```

Rejected pattern:

```text
"Table exists, so update it directly."
```

### Assessment Dependency Priority
**Decision:** LOCKED

During active exams:

```text
MUST HAVE
- Identity / Auth
- Assessment Core
- Answer Persistence
- Timer Authority
- Submission
- Essential Security

CAN DEGRADE
- Search
- Messaging
- Track
- Insight
- Partner
- Billing
- Noncritical Notification
```

### Failure Isolation
**Decision:** LOCKED

```text
Path Down
≠ Passport Down

Partner Down
≠ Academic Core Down

Track Down
≠ Exam Down

Insight Down
≠ Source Data Lost

Billing Down
≠ Active Exam Down
```

### Canonical Dependency Direction

```text
IDENTITY
   ↓
ORGANIZATION / TENANT
   ↓
ACADEMIC CORE
   ├──→ LEARN ──→ TRACK
   ├──→ ASSESS ─→ TRACK
   └──→ PARENT

TRACK ──→ CARE
TRACK ──→ PASSPORT
TRACK ──→ PATH
PASSPORT ──→ PATH
PATH ──→ OPPORTUNITY
OPPORTUNITY ──→ APPLICATION
APPLICATION ──→ VERIFIED CONNECTION
VERIFIED CONNECTION ──→ OUTCOME
OUTCOME ──→ ALUMNI / IMPACT
```

Shared cross-cutting capabilities:

```text
Notification
Messaging
Search
Feedback & Support
Audit
Security
Privacy
Insight
Billing
```

must not take ownership of source-domain records.

### R3.3 Result
**Decision:** LOCKED

All future Discovery, ERD, schema, API contract, architecture, and Build Unit work must respect these ownership and dependency rules.

---



## R3.4 — Legacy CBT Recovery & Port/Rewrite Audit

**Review Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

### Canonical Legacy Classification

```text
KEEP
PORT
REFACTOR
REWRITE
REFERENCE ONLY
DROP
```

No legacy code, schema, migration, RLS, RPC, UI component, environment, or business assumption is automatically authoritative for ELLIGBLE.

### Locked Legacy Decisions

```text
Kusuma Jaya CBT Product Identity           → DROP
Legacy CBT Requirements / Operational UX   → KEEP AS REQUIREMENT SOURCE

Student                                    → REFACTOR into canonical identity model
Teacher                                    → REFACTOR into SCHOOL_STAFF + assignment
Proctor                                    → REFACTOR into scoped assignment
School Operator                            → REFACTOR
super_admin                                → DROP / LEGACY ONLY

Question Bank Concept                      → KEEP / REWRITE
Optional Question Media                    → KEEP
Multiple Choice Baseline                   → KEEP
Legacy Question Delete Semantics           → REWRITE

Exam Scheduling                            → KEEP / REWRITE
Schedule Conflict Detection                → KEEP / EXPAND
Mandatory Free-Text Exam Name              → DROP

Exam Participant Concept                   → KEEP
Legacy exam_participants Schema            → REFERENCE ONLY
Legacy Participant Migration               → REFERENCE ONLY / DO NOT RE-RUN

CPNS-Inspired Exam UX                      → DESIGN REFERENCE
Fullscreen Requirement                     → KEEP / REWRITE
Timer                                      → REWRITE as server-authoritative
Autosave                                   → REWRITE around zero-lost-answer
Refresh / Reconnect Recovery               → KEEP / REWRITE
Submission                                 → REWRITE as idempotent

Tab / Focus Detection                      → REFACTOR
Copy / Paste / Context Menu Controls       → REFACTOR
DevTools Controls                          → REFERENCE / REWRITE with limitations
Single Active Session                      → REWRITE
Manual Lock                                → KEEP / REWRITE
Short-Lived Unlock Code                    → KEEP CONCEPT / REWRITE
Terminate                                  → KEEP / REWRITE
Time Extension                             → KEEP

Periodic Screenshot                        → KEEP / REWRITE
Violation-Triggered Screenshot             → KEEP / REWRITE
Continuous Video Surveillance              → DROP FROM BASELINE
Camera Evidence                            → KEEP CONDITIONAL

Battery Monitoring                         → KEEP
Network Monitoring                         → KEEP
IP Address                                 → CONTEXT SIGNAL
Location                                   → OPTIONAL / PRIVACY-CONTROLLED
Device Signals                             → KEEP / REFACTOR

Realtime Proctor Cards                     → KEEP / REDESIGN
Detail Drawer                              → KEEP
Warning / Instruction                      → KEEP
Violation Event Model                      → REWRITE
Evidence History                           → REWRITE
Automatic Punishment from Risk Signal      → DROP
False-Positive Resolution                  → KEEP
Appeal for High-Stakes Incident            → KEEP

Realtime Proctoring                        → KEEP
Realtime as Answer Persistence             → REJECT

InsForge                                   → KEEP AS INITIAL PROVIDER DIRECTION
Old InsForge Environment                   → REFERENCE ONLY
Old RLS                                    → REFERENCE ONLY UNTIL AUDITED
Old RPC / Functions                        → REFERENCE ONLY UNTIL AUDITED
Midtrans                                   → REFERENCE ONLY / REVALIDATE LATER
Billing / Assessment Isolation             → KEEP

Legacy UI Components                       → INDIVIDUAL AUDIT
Legacy CSS / Design                        → REFERENCE ONLY
Wholesale Legacy Folder Copy               → PROHIBITED
```

### Legacy Port Safety Rule

A legacy component may be classified `PORT` only after inspection confirms at minimum:

```text
No Hardcoded Secrets
No Old Tenant Assumptions
No super_admin Bypass
No Unsafe Client Admin Key
No Broken RLS Assumption
No Hidden Cross-Domain Write
No Canonical Naming Collision
No Obsolete Security Dependency
No Assessment Data-Loss Risk
Compatible with Current Architecture
```

If uncertainty remains, prefer `REWRITE` over unsafe `PORT`.

### Highest-Value Legacy Behaviors to Preserve

```text
1. Exam Operational Flow
2. Participant Assignment
3. Student Exam UX
4. Autosave / Recovery Expectations
5. Proctor Dashboard
6. Battery / Network / Device Visibility
7. Anti-Cheating Policy
8. Lock / Unlock / Terminate
9. Evidence / Violation Timeline
10. Schedule Conflict Logic
```

### R3.4 Result

**Decision:** LOCKED

Legacy CBT is an evidence and requirements source, not architecture authority. No code is pre-approved for `PORT` until file-level technical/security review is performed.

---

## R3.4A — Security Addendum: Baseline Password Policy

**Requirement Status:** REVIEWED & LOCKED  
**Owner Direction:** Password minimum = 8 characters.

### PASSWORD-01 — Minimum Length

```text
MINIMUM PASSWORD LENGTH = 8 CHARACTERS
```

This requirement applies to baseline password-based ELLIGBLE accounts unless a stronger privileged-account policy is defined later.

### PASSWORD-02 — Privileged Accounts May Be Stronger

Platform Owner, privileged Platform Staff, high-risk School Staff, and other sensitive accounts may later require stronger controls such as:

```text
MFA
Step-Up Authentication
Stronger Password Policy
Session Controls
Recovery Controls
```

Detailed privileged authentication policy remains Security Discovery work.

### PASSWORD-03 — Password Handling

Passwords must never be:

```text
stored as plaintext
logged
shown to support staff
included in diagnostics
included in audit payloads
```

Implementation must rely on the selected authentication provider's secure password handling and must be verified during Identity/Security Discovery.

---

## R3.4B — Secure Assessment Addendum: Split-Screen / Multi-Window Detection

**Product Requirement Status:** REVIEWED & LOCKED  
**Platform Feasibility:** CAPABILITY-DEPENDENT / TO BE VERIFIED PER PLATFORM

ELLIGBLE must explicitly anticipate built-in split-screen, multi-window, floating-window, and similar operating-system features that can allow another app/content to appear beside or over the exam.

### MULTIWINDOW-01 — Capability Is Part of Anti-Cheating

Add a canonical anti-cheating capability:

```text
DETECT_MULTI_WINDOW
```

with platform capability state:

```text
SUPPORTED
PARTIALLY_SUPPORTED
UNAVAILABLE
FALLBACK
```

This must be included in the pre-exam Device Capability Matrix.

### MULTIWINDOW-02 — Violation Event

Canonical event candidate:

```text
MULTI_WINDOW_DETECTED
MULTI_WINDOW_SUSPECTED
PICTURE_IN_PICTURE_DETECTED
WINDOW_NOT_FULL_SCREEN
```

Exact event taxonomy will be finalized in Anti-Cheating Discovery.

### MULTIWINDOW-03 — Android Native Direction

For a future native Android exam client, use operating-system multi-window signals where supported.

A positive native multi-window signal can be treated as stronger evidence than heuristic browser signals.

### MULTIWINDOW-04 — Web / PWA Direction

For initial web-first delivery, do NOT claim that browser JavaScript can always identify OS split-screen with certainty.

Web detection may combine signals such as:

```text
Fullscreen exit / fullscreen state
Page visibility state
Focus / blur
Viewport resize
Window dimensions
Screen / viewport relationship
Orientation / resize transitions
Unexpected layout geometry
```

These are contextual signals and may have legitimate causes such as:

```text
browser chrome
software keyboard
rotation
accessibility UI
device resizing
OS UI
```

Therefore the web state should normally be:

```text
MULTI_WINDOW_SUSPECTED
```

unless a platform-specific reliable signal exists.

### MULTIWINDOW-05 — iPadOS / Apple Windowing Direction

ELLIGBLE must anticipate iPad multitasking and dynamically resizable app windows.

Window-size/scene changes may be useful evidence in a future native client, but the architecture must not assume a universal semantic `isSplitScreen=true` API across Apple platforms.

Treat capability as platform/version dependent.

### MULTIWINDOW-06 — Fullscreen Relationship

When an exam security policy requires fullscreen:

```text
Fullscreen Requirement
+
Multi-Window Signals
+
Focus / Visibility Signals
```

may be evaluated together.

A transition out of required fullscreen can be logged even when the system cannot prove the exact reason was split-screen.

### MULTIWINDOW-07 — Enforcement Policy

Example configurable policy:

```text
DETECT_MULTI_WINDOW = ON

On reliable detection:
→ create violation event
→ warning / force return where supported
→ escalate according to exam security policy

On heuristic suspicion:
→ log contextual signal
→ optionally warn
→ risk evaluation
→ proctor review
```

### MULTIWINDOW-08 — No Automatic Cheating Verdict

Hard rule:

```text
MULTI_WINDOW SIGNAL
≠
CHEATING VERDICT
```

except where a school-approved deterministic policy explicitly defines a technical enforcement action.

Evidence strength and platform reliability must be visible to the proctor.

### MULTIWINDOW-09 — Device Capability Check

Pre-exam check should eventually show examples such as:

```text
Fullscreen               SUPPORTED
Multi-Window Detection   PARTIAL
Camera                   SUPPORTED
Battery Signal           SUPPORTED
Location Signal          PARTIAL
```

Students/proctors should know the exam security capability before the session begins.

### MULTIWINDOW-10 — Future Native Advantage

If web limitations prove materially insufficient for high-security exams, that becomes one of the legitimate reasons to build a dedicated native Android/iOS/iPadOS exam client later.

This does not change the current strategy:

```text
WEB-FIRST DELIVERY
MOBILE-FIRST UX
MULTI-PLATFORM-READY ARCHITECTURE
```

---



## R3.5 — Unresolved Gap & Missing Artifact Audit

**Review Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

### R3.5 Conclusion

No missing fundamental product domain was identified that requires returning to R2.

Remaining work is intentionally classified into:

```text
A. MUST CREATE AFTER RECOVERY
→ Modular Recovery / Governance artifacts

B. MUST RESOLVE DURING DISCOVERY
→ Detailed Product / Legal / Security / Business decisions

C. INTENTIONALLY LATER
→ ERD
→ API Contract
→ Folder Structure
→ Build Units
→ Implementation
```

### Key Missing / Discovery Artifacts

```text
Product Vision Final Document                    → MISSING
Product Domain Map                               → MISSING
Canonical Terminology                            → MISSING
Decision Hierarchy                               → MISSING
Agent Context Loading Rules                      → MISSING

Full Authentication Policy                       → DISCOVERY
Permission Matrix                                → MISSING
Break-Glass Policy                               → PROVISIONAL

Indonesian Academic Model Detail                 → DISCOVERY
Import Templates                                 → MISSING AFTER MODEL

Assessment State Machines                        → MISSING
Zero-Lost-Answer Protocol                        → MISSING / MANDATORY
Assessment Capability Matrix                     → MISSING / MANDATORY
Split-Screen Detailed Feasibility                → PROVISIONAL
Security Preset Composition                      → PROVISIONAL
Proctor Action Permission Matrix                 → MISSING
Legacy Source-Code Audit                         → LEGACY AUDIT

Learn Detailed Workflow                          → DISCOVERY
Track Metric Dictionary                          → MISSING
Early Warning Rules                              → OPEN / DISCOVERY
Care Safeguarding Policy                         → OPEN / LEGAL / OPERATIONS
Discipline Domain Detail                         → OPEN / DISCOVERY

Passport Record Taxonomy                         → MISSING
Passport Trust Rules                             → PROVISIONAL
Path Readiness Formula                           → OPEN
Higher-Education Data Source                     → MISSING

Partner Verification SOP                         → MISSING
Opportunity Moderation Policy                    → MISSING
Talent Discovery Searchable Fields               → PROVISIONAL

Tracer / Outcome Questionnaire                   → MISSING
Impact Metric Dictionary                         → MISSING

Notification Event Catalog                       → MISSING
Messaging Context Matrix                         → MISSING
Search Indexing Policy                           → MISSING
Feedback & Support Routing / SLA Matrix          → PROVISIONAL

Controller / Processor Matrix                    → OPEN / MANDATORY
Retention Matrix                                 → OPEN / MANDATORY
Consent Registry Design                          → MISSING
Data Classification Matrix                       → MISSING
DPIA Documents                                   → PRODUCTION-BLOCKING WHERE REQUIRED

Final Pricing                                    → OPEN
Pilot Commercial Agreement                       → MISSING
Infrastructure Cost Model                        → MISSING

Final Frontend Stack                             → PROVISIONAL
Clean ELLIGBLE InsForge Environment              → MISSING / DEFERRED
Module Boundaries                                → MISSING
Folder Structure                                 → INTENTIONALLY LATER
ERD                                              → INTENTIONALLY LATER
API Contract                                     → INTENTIONALLY LATER
Build Units                                      → INTENTIONALLY LATER

ELLIGBLE Design System                           → MISSING / EXPECTED
Role-Based Navigation / IA                       → MISSING
```

### Production Blockers, Not Recovery Blockers

```text
Controller / Processor Allocation
Retention Periods
Required DPIA
Care Safeguarding Policy
Partner Moderation Policy
Authentication / Security Detail
Assessment Platform Capability Testing
```

### Locked Sequencing Rule

```text
RECOVERY
↓
DISCOVERY
↓
MASTER BLUEPRINT
↓
ARCHITECTURE / ADR
↓
ERD / API / MODULE BOUNDARIES
↓
BUILD UNITS
↓
IMPLEMENTATION
```

The project must not skip directly from Recovery into coding simply because implementation is technically possible.

---



## R3.6 — Final OPEN / PROVISIONAL / FUTURE Register

**Review Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT

### Canonical Status Semantics

```text
LOCKED
= mandatory canonical decision

OPEN
= genuinely unresolved; agents must not invent an answer

PROVISIONAL
= direction/default exists, but detailed Discovery is required before related implementation

FUTURE
= valid direction outside current baseline; do not build without explicit future decision

DROP
= rejected / superseded; do not resurrect

LEGACY
= reference only unless explicitly audited and re-approved

PRODUCTION BLOCKER
= may remain unresolved during Recovery/early Discovery, but must be resolved before production launch
```

### Genuine OPEN Register

```text
Final Pricing                                  → OPEN / Business Model Discovery
Success Fee / Placement Revenue                → OPEN / FUTURE
Controller / Processor Legal Allocation        → OPEN / Legal Discovery / PRODUCTION BLOCKER
Final Retention Periods                        → OPEN / Legal & Data Governance / PRODUCTION BLOCKER
Early Warning Rules                            → OPEN / Track Discovery
Path Readiness Formula                         → OPEN / Path Discovery
Care Safeguarding Rules                        → OPEN / Care + Legal / PRODUCTION BLOCKER where Care launches
Discipline Placement                           → OPEN / Product Discovery
Higher-Education Data Source                   → OPEN / Path/Data Discovery
```

### PROVISIONAL Register

```text
Anti-Cheating Platform Capability              → PROVISIONAL / Capability Testing
Split-Screen Detailed Detection                → PROVISIONAL
Security Preset Composition                    → PROVISIONAL
Full Authentication Policy                     → PROVISIONAL
Break-Glass Policy                             → PROVISIONAL
Feedback & Support Routing / SLA               → PROVISIONAL
Passport Trust-Level Rules                     → PROVISIONAL
Talent Discovery Searchable Fields             → PROVISIONAL
Design System Details                          → PROVISIONAL
Final Technical Stack                          → PROVISIONAL
Cross-Domain FK / Event Strategy               → PROVISIONAL
Agent Skills                                   → PROVISIONAL
Build Unit ID Convention                       → PROVISIONAL
```

### FUTURE Register

```text
All AI Features                                → FUTURE / OPTIONAL / NON-BLOCKING
Native Android / iOS / iPadOS App              → FUTURE
Standardized ELLIGBLE Assessment               → FUTURE
Face Recognition / Biometric Proctoring        → FUTURE
Advanced AI Proctoring                         → FUTURE
Sponsored Opportunity                          → FUTURE
Custom Domain                                  → FUTURE / OPTIONAL
Advanced Trust & Safety Console                → FUTURE WORKSPACE
Merchant Expansion                             → FUTURE / SECONDARY
Public Alumni Directory                        → FUTURE / OPT-IN ONLY
Advanced Mentoring Marketplace                 → FUTURE
```

### DROP / PROHIBITED Register

```text
Social Feed as Primary Direction               → DROP / SUPERSEDED
Follower / Friend Graph                        → DROP / SUPERSEDED
SUPER_ADMIN Omnipotent Role                    → DROP / LEGACY
Standalone LPTPAT Module                       → DROP AS STANDALONE
Continuous Video Surveillance Baseline         → DROP
Automatic Cheating Verdict from Risk Signal    → DROP
Student Database Sale                          → PROHIBITED PRODUCT PRINCIPLE
```

### Production Blocker Register

```text
1. Controller / Processor Legal Allocation
2. Retention Matrix
3. Required DPIA
4. Authentication / Security Policy
5. Permission Matrix
6. Assessment Capability Testing
7. Zero-Lost-Answer Verification
8. Care Safeguarding Policy where Care launches
9. Partner Verification / Moderation Policy where Partner launches
10. Data Classification + Consent Governance
11. Backup + Restore Verification
12. Security / Incident-Response Readiness
```

### Baseline Scope Guard

**Decision:** LOCKED

Not every valid domain must launch on day one.

Preferred implementation direction:

```text
Shared Core
↓
Identity / Tenant / Access
↓
Minimum Academic Core
↓
Secure Assessment
↓
Operational Support / Security
↓
Other Core Domains in Controlled Waves
```

This is a delivery-priority rule, not a product-scope reduction.

### Agent Rule

```text
LOCKED
→ implement according to canonical decision

OPEN
→ do not invent; resolve in designated Discovery

PROVISIONAL
→ use only as Discovery starting point

FUTURE
→ do not build

DROP
→ do not resurrect

LEGACY
→ reference only unless audited
```

---

## R3.6A — Proactive Gap-Solving Governance

**Requirement Status:** REVIEWED & LOCKED  
**Owner Direction:** The assistant/architecture process must proactively identify important missing considerations and recommend the best feasible default rather than waiting for the Platform Owner to anticipate every issue.

### PROACTIVE-01 — Detect Unstated Gaps

The planning process must actively look for:

```text
Missing Requirements
Contradictions
Edge Cases
Security Risks
Privacy Risks
Operational Failure Modes
Scalability Risks
UX Traps
Accessibility Gaps
Legal Dependencies
Data-Loss Risks
Vendor Lock-In
Support / Maintenance Gaps
Abuse Scenarios
Migration / Recovery Risks
Monitoring / Backup Gaps
Implementation Traps for AI Coding Agents
```

### PROACTIVE-02 — Best-Default Rule

When a detail is not yet specified and a safe, conventional, reversible default exists:

```text
Identify the gap
↓
Recommend the safest / simplest / most scalable reasonable default
↓
Classify it correctly
↓
Route it to Discovery if detailed validation is still required
```

Do not create unnecessary decision burden for the Platform Owner.

### PROACTIVE-03 — No Silent Override of Canonical Decisions

Proactive recommendations must not silently replace existing `LOCKED` decisions.

If a newer issue creates a real conflict:

```text
Flag conflict
↓
Explain impact
↓
Recommend replacement
↓
Require explicit supersession decision
```

### PROACTIVE-04 — High-Risk / Legal / Uncertain Matters

For legal, privacy, security, safeguarding, financial, or technically uncertain matters:

```text
Recommend best direction
+
mark validation requirement
+
do not fabricate certainty
```

### PROACTIVE-05 — Prefer Realizable Architecture

When multiple options exist, prefer the option that best balances:

```text
Safety
Correctness
Maintainability
Cost
School Operability
Low Vendor Lock-In
Web-First Delivery
Future Multi-Platform Growth
Assessment Reliability
AI-Agent Implementability
```

### PROACTIVE-06 — Prevent Premature Complexity

Do not introduce:

```text
Microservices
Event Infrastructure
Native Apps
AI Dependencies
Complex Billing
Advanced Analytics
Extra Vendors
```

before a concrete need justifies them.

### PROACTIVE-07 — Prevent Under-Design of Critical Areas

Conversely, do not simplify away:

```text
Tenant Isolation
Authorization
Audit
Zero-Lost-Answer
Backup / Restore
Privacy
Support
Incident Handling
Migration History
Assessment Failure Isolation
```

even if they make implementation slightly slower.

---



## R3.7 — Recovery Freeze & Modularization Plan

**Review Status:** REVIEWED & LOCKED  
**Owner Approval:** APPROVED — OVERALL AGREEMENT  
**Recovery Outcome:** FROZEN

### R3.7-01 — Full Recovery Is Preserved as Archive

The consolidated Recovery source is preserved as a read-only historical artifact.

It is not a default agent context file.

### R3.7-02 — Master Recovery Index Must Remain Small

The active `00.00_ELLIGBLE_MASTER_RECOVERY_INDEX.md` is an index and handoff map, not a full transcript of Recovery.

### R3.7-03 — Recovery Is Modularized by Bounded Concern

Canonical Recovery modules:

```text
00.01 Product Identity & Purpose
00.02 Tenant, Identity & Access
00.03 Academic Core
00.04 Secure Assessment
00.05 Learn, Track, Care & Parent
00.06 Profile, Passport & Path
00.07 Partner, Opportunity & Alumni
00.08 Shared Platform Capabilities
00.09 Platform Operations & Commercial
00.10 Security, Privacy & Data Governance
00.11 Legacy CBT Recovery
00.12 Open / Provisional / Future Register
```

### R3.7-04 — Governance Is Separate From Recovery

Rules that agents repeatedly need must live in small governance files, including:

```text
Discovery Process
Decision Hierarchy
Canonical Terminology
Agent Context Rules
Build Execution Rules
Proactive Gap Governance
Domain Ownership & Contracts
```

### R3.7-05 — Master Context Must Stay Concise

`MASTER_CONTEXT.md` contains only cross-project facts that an agent must always understand.

It is not an encyclopedia of every feature.

### R3.7-06 — Current State Is the Operational Control File

`CURRENT_STATE.md` defines:

```text
Current Phase
Completed Work
Current Work
Forbidden Work
Next Action
Canonical Sources
```

### R3.7-07 — Decision Log Is a Decision Register, Not a Transcript

Canonical decision records remain concise and identify supersession where applicable.

### R3.7-08 — Discovery Will Also Be Modular

Discovery must not become another monolithic document.

### R3.7-09 — Design System Is a Dedicated Artifact

The ELLIGBLE Design System remains separate from Recovery and product requirements.

### R3.7-10 — Architecture Is Intentionally Not Created During Recovery

ERD, API contracts, database schema, module boundaries, deployment topology, and Build Units remain later artifacts.

### R3.7-11 — Agent Context Tiers

```text
TIER 0 — ALWAYS
READ_ME_FIRST.md
AGENTS.md
MASTER_CONTEXT.md
CURRENT_STATE.md
Canonical Terminology
Decision Hierarchy

TIER 1 — DOMAIN
Relevant Discovery / Domain Governance

TIER 2 — BUILD UNIT
Current Build Unit specification

TIER 3 — ON DEMAND
Recovery modules
Legacy audit
Full Recovery archive
```

### R3.7-12 — Context Budget Rule

If an execution needs several large unrelated domains at once, the task is probably too large and must be split.

### R3.7-13 — Predictable File Naming

Governance / Discovery files use ordered names.

Build Unit naming remains provisional until the architecture is frozen.

### R3.7-14 — No Duplicate Truth

A canonical rule should have one authoritative home. Other files reference or minimally summarize it.

### R3.7-15 — Canonical Source Header

Important documentation should expose:

```text
Status
Version
Canonical
Supersedes
Depends On
Used By
Last Reviewed
```

### R3.7-16 — Version Is Not the Only Authority Signal

Canonical status, decision hierarchy, and supersession determine authority.

### R3.7-17 — Superseded Artifacts Must Be Explicitly Marked

Old files must not remain visually indistinguishable from active specifications.

### R3.7-18 — Agents Cannot Invent New Canonical Rules

Agents may propose changes but cannot silently create a new canonical source of truth.

### R3.7-19 — No Silent Scope Expansion

Agents must not add unrelated features, vendors, AI dependencies, or architectural changes outside the current unit.

### R3.7-20 — Documentation Is Part of Definition of Done

Future Build Units require code, tests, migrations where applicable, security review, documentation updates, terminal verification, and Git review before `DONE`.

### R3.7-21 — Recovery Becomes Historical Foundation After Discovery Starts

Future implementation primarily reads Current State, Master Context, Governance, relevant Discovery, Blueprint/ADR, and Build Unit specifications.

### R3.7-22 — Full Recovery Archive Is Frozen

New decisions after Recovery Freeze belong in Discovery, Decision Log, or ADRs. Historical Recovery is not rewritten.

### R3.7-23 — `READ_ME_FIRST.md` Is Required

A new agent entering the repository must have a short deterministic entry path.

### R3.7-24 — Agent Skills Stay Minimal

Skills are added only after Discovery/Architecture establish a concrete need.

### R3.7-25 — Modularization Is Applied Once After Approval

The Recovery working source is converted into clean modular documentation in one finalization package.

### R3.7-26 — Document Manifest Is Required

The manifest identifies each file's purpose, authority, and agent read policy.

### R3.7-27 — Proactive Gap Review Continues After Recovery

Recovery Freeze does not stop proactive discovery of missing risks, edge cases, or implementation traps.

### Recovery Freeze Meaning

```text
Product identity recovered
Major product domains recovered
Old contradictions normalized
Canonical terminology established
Cross-domain ownership established
Legacy CBT classified
Missing artifacts identified
OPEN / PROVISIONAL / FUTURE registered
Recovery documentation modularized
```

Recovery Freeze does **not** mean every product detail is implementation-ready.

Detailed work now moves to Discovery.

---

# RECOVERY FREEZE

**Status:** FROZEN  
**Freeze Version:** 1.0.0  
**Next Phase:** DISCOVERY  
**Implementation Authorization:** NOT YET GRANTED

The next safe step is modular Discovery beginning with Product Vision / Product Boundary work under the approved Discovery Process.
