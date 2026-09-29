# ELLIGBLE

ELLIGBLE is a multi-tenant education platform for Indonesian secondary schools. Secure Assessment is the flagship, mission-critical domain.

Current program:

```text
Recovery / Discovery / Master Blueprint / Architecture → COMPLETE / LOCKED
Build → CONTINUOUS PRODUCTION COMPLETION (DEC-042)
        Program 1: canonical baseline completion (Secure Assessment first)
```

Start here:

- `READ_ME_FIRST.md` and `AGENTS.md`: entry path and agent rules.
- `docs/production/PRODUCTION_COMPLETION_PLAN.md`: live production state, critical path and next work.
- `docs/00-governance/`: governance (execution model in `00.10_CONTINUOUS_PRODUCTION_COMPLETION.md`).
- `docs/01-discovery/`, `docs/02-master-blueprint/`, `docs/architecture/`, `docs/design/`: locked product, architecture and design sources.

Code:

- `database/migrations/`: versioned PostgreSQL migrations.
- `runtime/`: Node.js (TypeScript) domain runtimes and the HTTP server.
- `frontend/web/`: React + TypeScript + Vite web client.
