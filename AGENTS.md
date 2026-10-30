# AGENTS.md — ELLIGBLE Agent Rules

## Mandatory Read Order

Before acting, you MUST use `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md` as the canonical context-reconstruction protocol.

**Core Requirements:**
- Require Git working-state verification (`git status --short`) before trusting dynamic state files.
- Read the living plan `docs/production/PRODUCTION_COMPLETION_PLAN.md` for current production state and the critical path. `CURRENT_STATE.md`, `HANDOFF_PACKET.md` and `BUILD_PHASE_INDEX.md` are frozen historical records (BU-090 terminal); `DOCUMENT_MANIFEST.md` is the document index.
- Read `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` (DEC-044: the current release is Secure Assessment / CBT only) and `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` (DEC-045: execute only the Owner-authorized Task, one bounded READY Task at a time; Task records in `docs/production/tasks/`).
- **Evidence-Over-Summary Rule:** Actual repository file content and Git output ALWAYS beat agent summaries or external reports.
- **Working-Tree Preservation Rule:** A modified/untracked file is evidence of possible in-progress work. Do NOT perform destructive cleanup merely to make Git appear clean.

## Never Override Canonical Decisions Silently

- A newer decision does NOT win merely because it is newer.
- Explicit owner-approved canonical supersession wins over the superseded predecessor.
- Non-superseded LOCKED/FROZEN decisions remain authoritative.
- If two active canonical decisions conflict and no explicit supersession exists: OWNER DECISION REQUIRED.
- Follow `docs/00-governance/00.02_DECISION_HIERARCHY.md` for exact authority resolution.

## Status Handling

```text
LOCKED       → follow
OPEN         → do not invent
PROVISIONAL  → Discovery starting point only
FUTURE       → do not build
DROP         → do not resurrect
LEGACY       → reference only until audited
```

## Current Phase Guard

- Current release: Secure Assessment / CBT only (DEC-044). Deferred domains (00.11 §8) are not planned, built or put on the critical path unless the Owner reopens them.
- Execution model: `docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md` (DEC-042). The live tracker is `docs/production/PRODUCTION_COMPLETION_PLAN.md`.
- `CURRENT_STATE.md`, `HANDOFF_PACKET.md`, `BUILD_PHASE_INDEX.md` and the roadmap status fields are frozen historical records at the BU-090 terminal state. Use them for history, not for live navigation.
- If the working tree is non-clean, execute the working-state reconstruction protocol in `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md` before acting.
- Never use a stale state file alone to overwrite or restart in-progress work.

Architecture, API and UI work must serve the critical path in the living plan and respect the LOCKED decisions it touches. Actual execution requires explicit Owner authorization of one bounded READY Task by ID under DEC-045 (00.12 §4–§5); critical-path relevance alone is not authorization.

## Product Guardrails

- Secure Assessment is mission-critical and highest priority.
- Student data is private by default.
- Student database is not sold.
- AI is FUTURE/OPTIONAL/NON-BLOCKING.
- ELLIGBLE is not a social-media/follower platform.
- LPTPAT is not a standalone new module.
- `SUPER_ADMIN` is legacy terminology.
- Password baseline is minimum 8 characters.
- Split-screen/multi-window is a required Assessment capability, but platform limits must be represented honestly.

## Architecture Guardrails

```text
Web-first delivery
Mobile-first student UX
Multi-platform-ready
Provider-agnostic; current release self-hosted on the school VPS (ADR-001 / DEC-046)
Modular monolith initially
One PostgreSQL database allowed with strict logical domain ownership
Versioned Git migrations only
```

No silent cross-domain table writes.

## Legacy Guardrail

Never copy legacy folders wholesale.

Use:

```text
KEEP
PORT
REFACTOR
REWRITE
REFERENCE ONLY
DROP
```

`PORT` requires file-level audit.

## Build Guardrail

Follow `docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md` (execution model) and the non-superseded parts of `docs/00-governance/00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md` (baseline-first priority, Baseline Completion Gate).

- **AUTHORIZED TASK ONLY (DEC-045):** implement only the Task the Owner authorized, within its contract; the critical path is the P11 Task baseline.
- **PRODUCT COMPLETION FIRST:** Prioritize the shortest safe production critical path recorded in `docs/production/PRODUCTION_COMPLETION_PLAN.md`. Execute only the bounded Task explicitly authorized by the Owner under DEC-045; keep the plan current in the same change. This product priority does not authorize autonomous Task selection or continuation.
- **NO NEW BUILD UNITS:** Do not create BU-091 or later, Stage-1..5 lifecycle records, Controller stage audits, or lifecycle-close / navigation-correction commits. BU-001..BU-090 are historical construction assets: do not reopen or rewrite them.
- **BASELINE PRIORITY:** `IN — CORE` + `IN — MANDATORY BASELINE` first. `OPTIONAL` / `FUTURE` stay deferred until the Baseline Completion Gate passes.
- **REUSE PROVEN CAPABILITIES:** Compose and extend existing runtime/schema capabilities; do not duplicate them. Fix them when evidence shows a defect.
- One coherent, verified product result per commit. No scope expansion beyond that result. No random vendors. No hidden AI dependencies.
- Verification before `DONE`: typecheck, unit, regression, real PostgreSQL, and browser end-to-end for critical journeys (see 00.10 §4).

## Frontend Guardrails

- **FRONTEND ENTRY GATE:** Production frontend implementation MUST NOT START until FRONTEND ENTRY GATE = PASS.
- **UI FOUNDATION (DEC-043):** shadcn/ui is the approved component foundation, themed with the locked ELLIGBLE tokens. Generic default shadcn styling must not ship. DesainPakeAI project `b5a22aa4-7b38-49d2-9448-443eab6e8075` is the Owner-approved UX direction, accessed through the `dpai` CLI only; it never overrides security, authorization, privacy, domain logic, accessibility or responsive correctness. Never print or commit `DPAI_API_KEY`.
- **FRONTEND AGENT SKILL CHECKPOINT:** At Frontend Entry Gate, a PURPOSE-FIT frontend/UI Agent Skill MUST be selected, verified, installed, and recorded before frontend coding. Do NOT select a random broad skill or freeze a skill name now.
- **FUTURE FRONTEND DESIGN SYSTEM GATE:** Before first production frontend implementation, `docs/design/FRONTEND_DESIGN_SYSTEM.md` and `docs/design/UI_CONTENT_AND_COPY_STYLE.md` MUST exist and be LOCKED. Do not choose final visual values now.
- **ANTI-AI-SLOP QUALITY GATE:** Mandatory frontend quality review prevents generic AI-generated SaaS appearance. Deliberate use of gradients, glassmorphism, rounded cards, shadows, bento layouts, pill badges, and animations is allowed ONLY when consistent with the locked design system and actual product need.
- **FRONTEND AGENT SKILL STACK:** Read `docs/design/FRONTEND_AGENT_SKILL_STACK.md` for all frontend UI work. Repository and locked design system remain the highest frontend authority.
- **SPECIALIZED SKILL USAGE & TOKEN DISCIPLINE:** Use specialized skills (`react-typescript-vite`, `frontend-design`, `frontend-responsive-ui`, `web-design-reviewer`) according to their documented canonical roles. Do not activate every design skill indiscriminately; maintain strict token and context discipline.
- **RENDERED VISUAL VERIFICATION:** Source code inspection, static typing, and automated unit/test PASS alone are not sufficient proof of visual quality or responsive correctness. Rendered visual verification across representative viewports (narrow mobile to wide desktop) is mandatory for all material UI changes.
- **CROSS-ROLE VISUAL CONSISTENCY:** ELLIGBLE must have ONE coherent core design language. Individual Build Units may NOT independently invent their own colors, fonts, spacing, buttons, forms, cards, or navigation patterns.
- **GLOBAL UI/UX CONSISTENCY CONTRACT (Owner, 2026-09-30, permanent):** one product, one design system across every role and module; design authority for UI/UX: Owner-approved DesainPakeAI project → product/domain/security requirements → compatible canonical visual decisions → shared ELLIGBLE tokens and primitives → shadcn/ui → page decisions. No per-page design systems; a pattern used twice becomes a shared primitive or documented variant. Full contract: `docs/production/PRODUCTION_COMPLETION_PLAN.md` §10.1 (work tracked as UI-SYSTEM tasks). Every UI task must answer: "Does this look and behave like the same ELLIGBLE product as every other role and module?" If not, fix the shared system rather than adding another isolated style.

## Git Identity and Attribution

- Commit only with the Owner's configured author and committer identity. Before the first commit of a session, check `git config user.name` and `git config user.email`; if they are not the Owner's identity, stop and ask. Never set an identity yourself.
- Never add AI, model or tool attribution to commits, trailers, pull request metadata or contributor metadata (no Co-Authored-By, Generated-By, Assisted-By or session links).
- After every commit, inspect `git log -1 --format=fuller` and the raw message; report any attribution instead of rewriting history.
- No force push. No rewriting of published history. The Owner merges into `main`.

## Secrets

Never expose or commit:

```text
passwords
tokens
admin keys
service credentials
production secrets
private student data
```

## User-Facing Language

Initial school-facing product UI is Bahasa Indonesia.

**THE EM DASH CHARACTER "—" IS PROHIBITED IN USER-FACING UI COPY.**
Use appropriate Indonesian punctuation instead. This rule applies to UI copy only; it must NOT rewrite internal canonical terminology (e.g., `IN — CORE`).

Internal code/API/database naming uses canonical English terminology.
