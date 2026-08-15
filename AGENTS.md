# AGENTS.md — ELLIGBLE Agent Rules

## Mandatory Read Order

Before acting, you MUST use `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md` as the canonical context-reconstruction protocol.

**Core Requirements:**
- Require Git working-state verification (`git status --short`) before trusting dynamic state files.
- Include and recognize `CURRENT_STATE.md`, `HANDOFF_PACKET.md`, `DOCUMENT_MANIFEST.md`, and the active phase index as state files that may represent the last synchronized baseline.
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

- `CURRENT_STATE.md` is part of the canonical baseline.
- If the working tree is clean, it may represent current synchronized state subject to normal consistency checks.
- If the working tree is non-clean, execute the canonical working-state reconstruction protocol in `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md` before determining active phase.
- Never use stale `CURRENT_STATE.md` alone to overwrite/restart authorized in-progress work.

Do not create ERD, API contracts, architecture, backend, frontend, or Build Units before the current phase authorizes them.

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
InsForge-first/provider-agnostic
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

Future implementation uses one Build Unit per execution.

No scope expansion. No random vendors. No hidden AI dependencies.

Terminal verification is mandatory before `DONE`.

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

Internal code/API/database naming uses canonical English terminology.
