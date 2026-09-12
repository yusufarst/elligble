**Status:** ACTIVE  
**Version:** 1.0.5
**Canonical:** YES  
**Supersedes:** 1.0.4
**Used By:** Governance, Discovery, Architecture  
**Last Reviewed:** 2026-09-12

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
| DEC-033 | Governance | Context & Governance Continuity Amendment | LOCKED | Owner |
| DEC-034 | Build Fast-Track | Build Unit Fast-Track Control v1 applies from BU-011+, reducing administrative lifecycle loops while preserving one-BU, verification, scope, repository, and safety gates | LOCKED | Owner / 00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md |
| DEC-035 | Full-Product Build Control | Full-Product / Baseline-First / Product-Milestone-Driven Build Control | LOCKED | Owner / 00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md |
| DEC-036 | Frontend Entry Gate | Frontend Entry, Design-System, and UI Quality Gate | LOCKED | Owner / Governance |
| DEC-037 | Frontend Stack & Entry Completion | React + TypeScript + Vite canonical production frontend stack foundation & Frontend Entry Gate completion | LOCKED | Owner / Frontend Entry Gate |

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

### DEC-033 — Context & Governance Continuity Amendment (2026-08-15)

**Version:** 1.0.1
**Status:** LOCKED
**Canonical artifacts:** `docs/00-governance/00.02_DECISION_HIERARCHY.md`, `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md`

Owner explicitly authorized:
- deterministic new-agent/new-chat reconstruction;
- Git working-state inspection before trusting dynamic state as complete current truth;
- LAST SYNCHRONIZED BASELINE semantics during active units;
- explicit supersession semantics;
- evidence-over-summary verification;
- protection of modified/untracked active work.

This amendment does NOT:
- reopen MB-01/MB-02/MB-03;
- lock MB-04;
- modify product scope;
- authorize Architecture;
- authorize Build.

### DEC-034 — Build Unit Fast-Track Control v1 (2026-08-26)

**Version:** 1.0.0
**Status:** LOCKED
**Canonical artifact:** `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`

Owner explicitly approved Build Unit Fast-Track Control v1:

- Applies from BU-011 onward.
- Does NOT supersede one-BU-per-execution rule.
- Combines administrative gates (registration acceptance, readiness acceptance, implementation acceptance, closure package acceptance) into a single controlled execution rather than skipping material gates.
- Owner Acceptance becomes exception-based: required only when OWNER DECISION REQUIRED triggers apply.
- Repository-first concise evidence is the default return format.
- External report/raw patch is NOT default; required only when Controller explicitly requests them.
- Targeted forward correction is preferred over full lifecycle restart.
- BU-011 must not start until the Fast-Track activation commit is physically verified by Controller.

### DEC-035 — Full-Product / Baseline-First / Product-Milestone-Driven Build Control (2026-09-12)

**Version:** 1.0.0
**Status:** LOCKED
**Canonical artifacts:** `docs/00-governance/00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md`, `docs/build/PRODUCT_COMPLETION_ROADMAP.md`

Owner explicitly approved Full-Product / Baseline-First / Product-Milestone-Driven Build Control:

- **Product completion is the objective; BU count is not:** Development tracks product capabilities, workflows, and user readiness rather than arbitrary Build Unit quantity.
- **Baseline-First Priority:** `IN — CORE` and `IN — MANDATORY BASELINE` have highest and exclusive implementation priority.
- **OPTIONAL and FUTURE Deferment:** `OPTIONAL` and `FUTURE` capabilities are deferred until the formal Baseline Completion Gate is passed. They are not eligible for normal successor selection during baseline work.
- **Baseline Completion Criteria:** Baseline must be actually usable, integrated end-to-end, verified, cross-domain coherent, secure, reliable, and production-ready. Backend-only, DB-only, or UI-only does not satisfy completion.
- **Current Milestone Scoping:** The current vertical milestone (Secure Assessment minimum browser-usable E2E vertical product) is the nearest operational milestone, not final project completion.
- **Post-Baseline Product Expansion:** After baseline completion gate pass, development continues systematically into Program 2 (OPTIONAL capabilities, followed by FUTURE capabilities).
- **Scope Preservation:** Existing MB-10 capability classifications are preserved until properly updated by canonical Owner decision.
- **Asset Reuse:** Proven persistence, runtime, reliability, readiness, and verification implementations from BU-001 through BU-077 are construction assets and must be reused/composed by vertical product work.
- **Controlled Execution Preserved:** Exactly one Build Unit per controlled execution, Fast-Track Control v1, and material verification gates remain mandatory.

### DEC-036 — Frontend Entry, Design-System, and UI Quality Gate (2026-09-12)

**Version:** 1.0.0
**Status:** LOCKED
**Canonical artifacts:** `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`, `docs/00-governance/00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md`, `docs/build/PRODUCT_COMPLETION_ROADMAP.md`

Owner-approved meaning:
- frontend production coding cannot start before Frontend Entry Gate PASS;
- purpose-fit frontend/UI Agent Skill required at frontend entry;
- Design System required before production UI implementation;
- UI Content/Copy Style required before production UI implementation;
- anti-AI-slop quality gate required;
- consistent design language across roles/modules required;
- em dash prohibited in user-facing UI copy;
- exact skill/design-token choices intentionally deferred until frontend entry when stack/tool availability is known.

### DEC-037 — Production Frontend Stack Foundation & Frontend Entry Gate Completion (2026-09-12)

**Version:** 1.0.0
**Status:** LOCKED
**Canonical artifacts:** `docs/design/FRONTEND_DESIGN_SYSTEM.md`, `docs/design/UI_CONTENT_AND_COPY_STYLE.md`, `docs/design/README.md`

Owner explicitly approved the production frontend stack foundation and completed the Frontend Entry Gate:

- **Canonical Production Frontend Stack Foundation:** React + TypeScript + Vite is the canonical production frontend stack foundation for ELLIGBLE Program 1, beginning with the Secure Assessment browser vertical product.
- **Unapproved Technologies Not Preselected:** This approval does NOT preselect or authorize Tailwind, shadcn/ui, Material UI, Chakra, Bootstrap, Redux, Zustand, React Router, TanStack Router, Next.js, SSR, hosting vendor, authentication provider, or third-party component/animation libraries.
- **Purpose-Fit Frontend Agent Skill Selected & Verified:** `react-typescript-vite` (v1.0.0, Antigravity Customization Ecosystem: `~/.gemini/config/skills/react-typescript-vite/SKILL.md`) is selected, installed, and verified for strictly-typed React component architecture, Vite ESM native bundling, WCAG 2.1 AA accessibility, and mobile-first responsive design.
- **Canonical Design System Locked:** `docs/design/FRONTEND_DESIGN_SYSTEM.md` (v1.0.0, LOCKED) establishes the platform-wide design tokens, typography, surfaces, spacing scale, component patterns, anti-AI-slop quality rules, and Secure Assessment distraction-control requirements.
- **Canonical UI Content and Copy Style Locked:** `docs/design/UI_CONTENT_AND_COPY_STYLE.md` (v1.0.0, LOCKED) establishes Bahasa Indonesia as the primary school-facing UI language, strictly prohibits the em dash ("—") in user-facing UI copy, and standardizes calm, institutional academic terminology.
- **Frontend Entry Gate Status:** PASS. The prerequisites to commence production user-facing frontend Build Units are fully satisfied.
