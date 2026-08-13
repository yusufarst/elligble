# AGENTS.md — ELLIGBLE Agent Rules

## Mandatory Read Order

Before acting:

```text
READ_ME_FIRST.md
docs/master/MASTER_CONTEXT.md
docs/state/CURRENT_STATE.md
docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md
docs/00-governance/00.02_DECISION_HIERARCHY.md
```

Then load only the relevant task/domain context.

## Never Override Canonical Decisions Silently

Newer `LOCKED` decisions win over old Recovery inventory, legacy CBT terminology, and earlier assumptions.

If a conflict is real, report it and require explicit supersession.

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

Follow `docs/state/CURRENT_STATE.md`.

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
