**Status:** LOCKED  
**Version:** 1.1.0  
**Canonical:** YES  
**Supersedes:** Earlier incomplete project summaries  
**Depends On:** Recovery Freeze 1.0.0, Discovery 01 v1.0.0, Discovery 02 v1.0.0, Discovery 03 v1.0.0, Discovery 04 v1.0.1  
**Used By:** Every agent execution  
**Last Reviewed:** 2026-08-14

# ELLIGBLE — Master Context

## Product Identity

ELLIGBLE is a **multi-tenant education superapp / education-to-future platform** for Indonesian upper-secondary institutions.

Academic tenants:

```text
SMA
SMK
MA
MAK
sederajat
```

SMP/MTs are not part of the current academic-tenant scope.

SMA N 1 Mlati is the pilot/reference tenant, not the identity of the product.

## Long-Term Purpose

ELLIGBLE supports the student journey from school operations and learning through assessment, progress tracking, trusted records, future planning, opportunities, verified outcomes, and alumni continuity.

The platform may contribute to better education-to-work/higher-education transitions, but it must not promise guaranteed admission, employment, or unemployment reduction without evidence.

## Flagship Domain

**Secure Assessment is the highest-priority, most urgent, mission-critical flagship domain.**

Other modules must not destabilize active exams.

## Product Boundary

ELLIGBLE is not:

```text
a LinkedIn clone
a social-media feed
a follower/friend network
a student-data marketplace
an AI-dependent product
a CBT-only product
```

LinkedIn may inspire selected UX/product patterns only.

## Canonical Domain Map

```text
ELLIGBLE
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
├── School Operating System
│   ├── Academic Core
│   ├── Learn
│   ├── Student Administration
│   ├── Parent / Guardian
│   ├── Care
│   └── School Insight
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
├── Track
├── Passport
├── Path
├── Partner & Opportunity Ecosystem
│   ├── Partner Organization
│   ├── Opportunity
│   ├── Application
│   ├── Verified Connection
│   └── Outcome
└── Alumni & Impact
```

## Identity & Authorization

Preferred conceptual stack:

```text
PERSON
↓
USER ACCOUNT
↓
ORGANIZATION / TENANT MEMBERSHIP
↓
BASE ACCESS TYPE
↓
ASSIGNMENT
↓
CAPABILITY
↓
SCOPE / POLICY / CONTEXT
```

One human should normally keep one global Person identity through school transfer, graduation, alumni status, guardian roles, staff roles, and partner contexts.

`SUPER_ADMIN` is legacy terminology and must not be recreated as an omnipotent role.

## Academic Boundary

One school is one academic tenant.

Academic Core owns the minimum shared academic truth including:
- academic year / period
- grade
- program / major / concentration
- curriculum context
- subject
- subject offering
- Academic Group / Rombel
- student enrollment
- teaching assignment
- homeroom responsibility where used
- selected official academic result projection
- student academic lifecycle

General school timetable / attendance
→ OUT OF CURRENT BASELINE

Secure Assessment
→ owns exam timing, exam runtime, exam operational presence/check-in where used

Learn
→ may own its optional digital activity timing

## Assessment Reliability

Key rules:

```text
No Lost Answers
Server-Authoritative Timer
Idempotent Submission
Attempt ≠ Session
Participant ≠ Attempt
Published Exam Snapshot Is Immutable
Realtime Proctoring ≠ Answer Persistence
```

Split-screen/multi-window is a required anti-cheating capability, but detection strength must be represented honestly per platform.

- baseline question type is single-answer multiple choice A–E
- text/image/text+image options are supported
- personal mobile data/hotspot is allowed; school Wi-Fi is not mandatory
- network change is context/signal, not cheating proof
- teacher-managed daily/subject assessment may be monitored by its authorized creator teacher within scope without separate School Operator proctor assignment
- institution-managed/high-stakes exams retain explicit proctor governance
- baseline unlock is a direct authorized Proctor dashboard action
- no ordinary student-facing unlock-code dependency

## Password Baseline

Password-based accounts require a minimum password length of **8 characters**.

Privileged authentication may require stronger controls/MFA.

## Delivery & Architecture Direction

```text
WEB-FIRST DELIVERY
MOBILE-FIRST STUDENT UX
MULTI-PLATFORM-READY ARCHITECTURE
INSFORGE-FIRST / PROVIDER-AGNOSTIC
MODULAR MONOLITH INITIALLY
CONTROLLED SHARED POSTGRES
VERSIONED GIT MIGRATIONS
```

Do not initialize architecture details before their Discovery/Architecture phase.

## AI Policy

All AI capabilities are:

```text
FUTURE
OPTIONAL
NON-BLOCKING
NO BASELINE DEPENDENCY
NO PAID AI REQUIRED
```

Do not build AI features during baseline unless an explicit future decision supersedes this rule.

## Privacy & Trust

Student data is private by default.

Partner access is purpose-limited and consent-based.

Care/counseling data is highly restricted.

Passport uses provenance and granular visibility.

Risk signals do not automatically prove cheating, fraud, diagnosis, or misconduct.

Student data is not sold.

## Feedback & Support

Every supported role must have access to **Bantuan & Feedback**.

Routing is role/context/category aware and may direct cases to school support, exam support, ELLIGBLE support, Security/Privacy, Trust & Safety, Partner Operations, or other scoped queues.

## Legacy CBT

Legacy CBT is a requirements/evidence source, not architecture authority.

No legacy source, schema, migration, RLS, RPC, or UI component is automatically approved for reuse.

## Build Philosophy

```text
Recovery
↓
Discovery
↓
Master Blueprint
↓
Architecture / ADR
↓
ERD / API / Module Boundaries
↓
Build Units
↓
Implementation
```

One Build Unit per agent execution. Terminal verification is required before `DONE`.
