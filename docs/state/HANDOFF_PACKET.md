**Status:** ACTIVE
**Version:** 0.1.11
**Canonical:** DYNAMIC NAVIGATION SNAPSHOT
**Phase:** MASTER BLUEPRINT
**Depends On:** CURRENT_STATE, Decision Hierarchy, canonical LOCKED/FROZEN project documents
**Used By:** New Chat / New Agent Context Reconstruction
**Last Reviewed:** 2026-08-15

# ELLIGBLE Handoff Packet

**Purpose:** A compact context recovery packet for a new ChatGPT conversation or new agent.

**Authority Warning:** `HANDOFF_PACKET` is a DYNAMIC CONTEXT/NAVIGATION SNAPSHOT. It is NOT higher authority than:
1. Decision Hierarchy
2. LOCKED/FROZEN canonical decisions
3. `CURRENT_STATE` for current phase/task truth

If `HANDOFF_PACKET` becomes stale or conflicts with a higher-authority source, the higher-authority source wins.

## Project Identity

**Project:** ELLIGBLE
**Product:** multi-tenant education superapp / education-to-future platform

**Academic tenants:**
- SMA
- SMK
- MA
- MAK
- sederajat

SMP/MTs are outside current academic-tenant scope.

**Pilot/reference tenant:**
SMA N 1 Mlati (Note: SMA N 1 Mlati is not the identity of the platform).

ELLIGBLE is NOT:
- LinkedIn clone
- social-media feed
- follower/friend network
- CBT-only product
- AI-dependent product
- student-data marketplace

**Highest-priority flagship:**
Secure Assessment

## Canonical Phase State

RECOVERY
→ COMPLETE / FROZEN v1.0.0

DISCOVERY 01
→ COMPLETE / LOCKED v1.0.0

DISCOVERY 02
→ COMPLETE / LOCKED v1.0.0

DISCOVERY 03
→ COMPLETE / LOCKED v1.0.0

DISCOVERY 04
→ COMPLETE / LOCKED v1.0.1

MASTER BLUEPRINT
→ IN PROGRESS

LAST COMPLETED UNIT
→ MB-07 Reliability & Failure Containment / LOCKED v1.0.0

ACTIVE UNIT
→ NONE

NEXT UNIT
→ MB-08 Cross-Domain Contracts & Integrations / NOT STARTED / NEXT

ARCHITECTURE
→ NOT STARTED

BUILD
→ NOT STARTED

## Last Verified Git State

**Project root:** `C:\Projects\ELLIGBLE`
**Branch:** `main`
**Remote:** `origin https://github.com/yusufarst/elligble.git`
**Repository visibility:** PRIVATE

Previous committed baseline before the MB-03 lock package:

6ce2b9e31465ad57224626eb157b3eedb2bbd5c5

**Git verification rule:**
A new agent/session must verify current HEAD and working-tree state from Git when repository access is available. HANDOFF_PACKET does not attempt to self-reference the commit that contains its own latest update.

## Completed Work

- Recovery Freeze v1.0.0
- Discovery 01 v1.0.0
- Discovery 02 v1.0.0
- Discovery 03 v1.0.0
- Discovery 04 v1.0.1
- GOV-SYNC-01 PASS
- MB-00 Context Resilience Bootstrap → COMPLETE / LOCKED v1.0.0
- MB-01 Platform System Map → COMPLETE / LOCKED v1.0.0
- MB-02 Domain & Module Map → COMPLETE / LOCKED v1.0.0
- MB-03 Actor, Role & Context Map → COMPLETE / LOCKED v1.0.0
- MB-04 Core Journeys & Critical Flows → COMPLETE / LOCKED v1.0.0
- MB-05 Data Trust & Continuity Model → COMPLETE / LOCKED v1.0.0
- MB-06 Security, Privacy & Risk Boundaries → COMPLETE / LOCKED v1.0.0
- MB-07 Reliability & Failure Containment → COMPLETE / LOCKED v1.0.0

## Current Active Task

**Current Master Blueprint state:**

MB-00
→ COMPLETE / LOCKED v1.0.0

MB-01
→ COMPLETE / LOCKED v1.0.0

MB-02
→ COMPLETE / LOCKED v1.0.0

MB-03
→ COMPLETE / LOCKED v1.0.0

MB-04
→ COMPLETE / LOCKED v1.0.0

MB-05
→ COMPLETE / LOCKED v1.0.0

MB-06
→ COMPLETE / LOCKED v1.0.0

MB-07
→ COMPLETE / LOCKED v1.0.0

## Exact Next Authorized Action

MB-07 GIT FINALIZATION

## Locked Decisions That Must Not Be Reopened

- upper-secondary academic tenant scope
- one school = one academic tenant baseline
- Organization ≠ Tenant
- Person ≠ User Account ≠ Membership
- global Person continuity
- student identity survives graduation
- Teacher ≠ Teaching Assignment
- Teacher ≠ Proctor
- Academic Group/Rombel ≠ Learning Classroom ≠ Exam Room
- Student ≠ Exam Participant ≠ Exam Attempt ≠ Exam Session
- Assessment Type ≠ Exam Instance
- Question Bank Item ≠ immutable Exam Question Snapshot
- Assessment Score ≠ Official School Grade
- Violation Event ≠ Risk Signal ≠ Incident ≠ Cheating Decision
- risk signal is not verdict
- network/IP/location change is not cheating proof
- general school timetable OUT OF CURRENT BASELINE
- general school attendance OUT OF CURRENT BASELINE
- Learn optional
- Secure Assessment mission-critical
- No Lost Answers
- Server-Authoritative Timer
- Idempotent Submission
- active exams must be protected from noncritical module failure
- partner has no unrestricted student search
- student data private by default
- AI FUTURE / OPTIONAL / NON-BLOCKING
- SUPER_ADMIN rejected
- ELLIGBLE is not social media

## Important Product Constraints

### Identity
Person ≠ User Account ≠ Membership.

### Authorization
Authorization is not determined by role name alone. It depends on membership + assignment + capabilities + scope + policy/context.

### Academic Core
Academic Core must remain minimum shared academic truth and must not silently become a full SIS/ERP. General timetable and general attendance are outside current baseline.

### Secure Assessment
Secure Assessment is mission-critical. Active exams must be protected from noncritical module failure.

### Anti-Cheating / Risk
Personal mobile data/hotspot is allowed; school Wi-Fi is not mandatory. Network/IP/location changes are context signals, not cheating proof. Risk signal is not verdict.

### Teacher-managed Assessment
Teacher with valid authorized context may monitor their own teacher-managed Exam Instance, without making Teacher = Proctor globally.

### Privacy / Trust
Care data is highly restricted. Passport requires provenance and granular visibility.

### Partner Access
Partner access is purpose-limited and consent/authorization-aware.

### Lifecycle Continuity
Student identity and trusted history must survive graduation/transfer according to canonical rules.

### AI Policy
All AI remains optional/non-blocking future capability.

## OPEN / PROVISIONAL / FUTURE Register

*This snapshot may be shorter than the canonical register. For authoritative/current detail, use: `docs/00-recovery/00.12_OPEN_PROVISIONAL_FUTURE_REGISTER.md` and later higher-authority canonical decisions.*

**OPEN:**
- final pricing
- success fee
- controller/processor allocation
- retention periods
- early warning rules
- Path formula
- Care safeguarding
- Discipline placement
- higher-education source strategy

**PROVISIONAL:**
- detailed anti-cheating capability matrix
- detailed split-screen heuristics
- anti-cheating preset details
- full authentication mechanics
- break-glass implementation
- support routing/SLA
- Passport trust rules
- talent discovery fields
- final design system
- final technology stack
- FK/event strategy
- Agent Skills/tooling
- Build Unit IDs

**FUTURE:**
- all AI capabilities
- native mobile apps
- biometrics
- AI proctoring
- standardized ELLIGBLE assessment
- sponsored opportunities
- custom domains
- merchant expansion
- public alumni directory opt-in
- advanced mentoring
- full E-Rapor

## Forbidden Premature Work

DO NOT:
- create ERD
- define database schema
- create API contracts
- define endpoint paths
- initialize frontend
- initialize backend
- create InsForge project
- create migrations
- create production application code
- create Build Units
- install random Agent Skills
- copy legacy CBT wholesale
- re-run legacy migrations
- build FUTURE AI/native/sponsored capabilities

## Required Entry Files for New Agent

DO NOT load the full Recovery archive by default.

For a NEW AGENT or NEW CHAT, context reconstruction must PASS before making changes. Read files strictly in this order:

1. `READ_ME_FIRST.md`
2. `AGENTS.md`
3. `docs/master/MASTER_CONTEXT.md`
4. `docs/state/CURRENT_STATE.md`
5. `docs/state/HANDOFF_PACKET.md`
6. `docs/DOCUMENT_MANIFEST.md`
7. `docs/00-governance/00.02_DECISION_HIERARCHY.md`
8. `docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md`
9. active phase index
10. only relevant PHASE/DOMAIN documents according to the Manifest

## Current Master Blueprint Index Snapshot

MB-00 Context Resilience Bootstrap
→ LOCKED v1.0.0

MB-01 Platform System Map
→ LOCKED v1.0.0

MB-02 Domain & Module Map
→ LOCKED v1.0.0

MB-03 Actor, Role & Context Map
→ LOCKED v1.0.0

MB-04 Core Journeys & Critical Flows
→ LOCKED v1.0.0

MB-05 Data Trust & Continuity Model
→ LOCKED v1.0.0

MB-06 Security, Privacy & Risk Boundaries
→ LOCKED v1.0.0

MB-07 Reliability & Failure Containment
→ LOCKED v1.0.0

MB-08 Cross-Domain Contracts & Integrations
→ NOT STARTED

MB-09 Delivery Sequence & Dependencies
→ NOT STARTED

MB-10 Baseline, Future & Exclusions
→ NOT STARTED

MB-11 Traceability Matrix
→ NOT STARTED

MB-12 Master Blueprint Exit Gate
→ NOT STARTED

For full index reference, see: `docs/02-master-blueprint/02.00_MASTER_BLUEPRINT_INDEX.md`

## Recent Relevant Commits

b8ce06b
docs(GOV-SYNC-01): synchronize canonical project state

203cb97
docs(D04): finalize secure assessment v1.0.1

8b0c556
docs(D03): finalize academic core v1.0.0

ee3cbb2
docs(D02): finalize tenant organization identity access v1.0.0

ce4e631
docs(D01): finalize product vision and boundaries v1.0.0

## Unresolved Risks / Contradictions

Current Master Blueprint blocking contradiction:
NONE CURRENTLY IDENTIFIED

OPEN and PROVISIONAL items are NOT contradictions by themselves.

If a new agent identifies a conflict, it must record:
- issue
- affected documents
- authority level
- safest temporary interpretation
- whether owner decision is required

## Context Recovery Protocol

When opened by a new ChatGPT conversation or new agent:

1. Do not rely on memory from another conversation.
2. Do not ask the owner to repeat documented decisions.
3. Read required entry files in prescribed order.
4. Determine current phase from CURRENT_STATE.
5. Determine active/next unit.
6. Identify prohibited premature work.
7. Identify OPEN/PROVISIONAL/FUTURE items relevant to current task.
8. Check for contradictions.
9. Higher-authority LOCKED/FROZEN decisions override this packet.
10. If this packet is stale, CURRENT_STATE + Decision Hierarchy + canonical sources win.
11. Do not make project changes until context reconstruction PASS.
12. If reconstruction fails, STOP and identify the exact missing or contradictory source.

## Context Reconstruction Result Template

CONTEXT RECONSTRUCTION RESULT

Project:
ELLIGBLE

Current phase:
...

Last completed unit:
...

Current/next unit:
...

Highest-priority product constraint:
...

Required documents loaded:
...

Prohibited premature work:
...

Relevant OPEN/PROVISIONAL/FUTURE items:
...

Contradictions found:
NONE / ...

Context status:
PASS / BLOCKED

Rules:

If BLOCKED:
STOP. Do not edit project.

If PASS:
WAIT for owner instruction.
Do not automatically modify project.
