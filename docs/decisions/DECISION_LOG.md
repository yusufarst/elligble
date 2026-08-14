**Status:** ACTIVE  
**Version:** 1.0.0  
**Canonical:** YES  
**Used By:** Governance, Discovery, Architecture  
**Last Reviewed:** 2026-08-14

# ELLIGBLE — Decision Log

This file records concise canonical decisions. Detailed rationale remains in Recovery/Discovery/ADR sources.

| ID | Topic | Decision | Status | Source |
|---|---|---|---|---|
| DEC-001 | Product identity | ELLIGBLE is a multi-tenant education superapp / education-to-future platform | LOCKED | R2.1–R2.3 |
| DEC-002 | Academic tenants | SMA/SMK/MA/MAK/sederajat; SMP/MTs excluded from current tenant scope | LOCKED | R2.1 |
| DEC-003 | Pilot | SMA N 1 Mlati is pilot/reference tenant only | LOCKED | R2.1 |
| DEC-004 | Assessment | Secure Assessment is flagship and mission-critical | LOCKED | R2.2/R2.14 |
| DEC-005 | Social direction | Home is operational command center; social Feed/follower graph rejected | LOCKED / DROP old direction | R2.3/R3.1–R3.2 |
| DEC-006 | Identity | One global Person identity with memberships/assignments/capabilities | LOCKED | R2.5–R2.6 |
| DEC-007 | Tenant | One school = one academic tenant; organization groups do not bypass isolation | LOCKED | R2.4 |
| DEC-008 | Architecture | Web-first, mobile-first UX, multi-platform-ready | LOCKED | R2.9 |
| DEC-009 | Backend | InsForge-first/provider-agnostic; modular monolith initially | LOCKED | R2.10 |
| DEC-010 | AI | AI is FUTURE/OPTIONAL/NON-BLOCKING; no paid AI required baseline | LOCKED | R2 global/R3.1 |
| DEC-011 | Profile/Passport | Profile ≠ Passport; Passport is portable and provenance-based | LOCKED | R2.12 |
| DEC-012 | LPTPAT | LPTPAT is historical lineage, not a standalone ELLIGBLE module | LOCKED | R2.16/R3.2 |
| DEC-013 | Care | Care ≠ Discipline; private counseling data remains restricted | LOCKED | R2.17 |
| DEC-014 | Guardian | Parent UI maps to canonical Guardian relationship; no unrestricted child access | LOCKED | R2.18/R3.2 |
| DEC-015 | Path | Path is Bridging Engine; readiness ≠ prediction; goal ≠ outcome | LOCKED | R2.19 |
| DEC-016 | Partner | Partner ≠ academic tenant; student data access is consent/purpose limited | LOCKED | R2.20 |
| DEC-017 | Alumni | Alumni retains same Person/Passport/Path identity | LOCKED | R2.21 |
| DEC-018 | Communication | Messaging is relationship-scoped; Search is permission-aware | LOCKED | R2.22 |
| DEC-019 | Support | Every role receives role/context-aware Bantuan & Feedback | LOCKED | R2.25 addendum |
| DEC-020 | Commercial | School is initial payer; core modules are not artificially paywalled | LOCKED | R2.24 |
| DEC-021 | Student data | Student database is not sold | PROHIBITED | R2.24 |
| DEC-022 | Password | Minimum password length = 8 characters | LOCKED | R3.4A |
| DEC-023 | Split screen | Multi-window/split-screen must be addressed with platform capability honesty | LOCKED requirement | R3.4B |
| DEC-024 | Cross-domain | One domain owns truth; no silent cross-domain table writes | LOCKED | R3.3 |
| DEC-025 | Legacy | No legacy code is approved for PORT without file-level audit | LOCKED | R3.4 |
| DEC-026 | Status semantics | OPEN/PROVISIONAL/FUTURE/DROP/LEGACY have strict meanings | LOCKED | R3.6 |
| DEC-027 | Build scope | One Build Unit per agent execution; no marathon build | LOCKED | Governance |
| DEC-028 | Recovery | Recovery frozen and modularized before Discovery | LOCKED | R3.7 |
| DEC-029 | Discovery 01 | Product Vision & Boundaries finalized v1.0.0 | LOCKED | D01.1–D01.7 |
| DEC-030 | Discovery 02 | Tenant / Organization / Identity / Access Foundation finalized v1.0.0 | LOCKED | D02.1–D02.10 |
| DEC-031 | Discovery 03 | Academic Core finalized v1.0.0 | LOCKED | D03.1–D03.9 |
| DEC-032 | Discovery 04 | Secure Assessment finalized v1.0.1 | LOCKED | D04.1–D04.10 |

### DEC-029 — Discovery 01 Finalized (2026-08-14)

**Version:** 1.0.0  
**Status:** LOCKED  
**Canonical artifact:** `docs/01-discovery/01.01_PRODUCT_VISION_AND_BOUNDARIES.md`

Discovery 01 locked the following:

- Product vision and mission
- Primary customer (school institution) / primary beneficiary (student)
- Secure Assessment as initial adoption wedge
- Product boundaries (not social media, not AI-dependent, not student-data marketplace)
- ELLIGBLE Talent Assurance strategic direction (mechanism remains FUTURE/PROVISIONAL)
- Product principles and non-negotiables
- North-Star direction
- Risk and anti-goal framework
- Proctor Feed Kejadian/Pelanggaran as a required Assessment capability
- Discovery 02 (Tenant / Organization / Identity / Access Foundation) as next phase
- Agent Skill installation remains NOT YET

### DEC-030 — Discovery 02 Finalized (2026-08-14)

**Version:** 1.0.0  
**Status:** LOCKED  
**Canonical artifact:** `docs/01-discovery/02.01_TENANT_ORGANIZATION_IDENTITY_ACCESS.md`

Discovery 02 locked the following (D02.1–D02.10, owner approved):

- Canonical identity model: Person ≠ User Account ≠ Membership
- Organization ≠ Tenant ≠ Organization Group
- Authorization stack: base access + membership + assignment + capability + scope + policy/context
- Base access types: PLATFORM_OWNER, PLATFORM_STAFF, SCHOOL_STAFF, STUDENT, GUARDIAN, ALUMNI, PARTNER_STAFF
- SUPER_ADMIN rejected
- Guardian = relationship-based access; Alumni = lifecycle/context of same Person
- ELLIGBLE ID/username + password (min 8 chars) = baseline authentication direction
- MFA/step-up = risk-based for privileged context
- Authorization is server-side enforced
- Import = duplicate-aware + preview + idempotent; silent Person merge prohibited
- Support never requests password/OTP/token
- Paid AI is not a baseline dependency
- OPEN/PROVISIONAL/FUTURE items remain at their declared status
- Architecture and Build gates remain closed
- Agent Skill installation remains NOT YET
- Next: Discovery 03 — Academic Core

### DEC-031 — Discovery 03 Finalized (2026-08-14)

**Version:** 1.0.0  
**Status:** LOCKED  
**Canonical artifact:** `docs/01-discovery/03.01_ACADEMIC_CORE.md`

Discovery 03 locked the following (D03.1–D03.9, owner approved):

- Academic Core = minimum shared academic truth
- Attendance/general timetable/full gradebook = out of baseline
- Report-card-supporting data = foundation-ready
- Full E-Rapor = FUTURE
- Secure Assessment = next Discovery
- Architecture/Build gates remain closed
- Agent Skills remain NOT YET

### DEC-032 — Discovery 04 Finalized (2026-08-14)

**Version:** 1.0.1  
**Status:** LOCKED  
**Canonical artifact:** `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`

Discovery 04 locked the following (D04.1–D04.10, owner approved):

- PG A–E only baseline; text/image options supported
- zero-lost-answers layered resilience
- local recovery + server-authoritative persistence
- mixed-class Exam Rooms + Seating Plan
- susulan/retake history continuity
- scoped Proctor Feed + non-blocking broadcast
- customizable RINGAN/STANDAR/KETAT
- camera FUTURE
- optional permission-based entire-screen high-assurance capture
- school Wi-Fi OR personal mobile data/hotspot permitted
- Master Blueprint = NEXT
- Architecture/Build gates remain closed
- Agent Skills remain NOT YET
