**Status:** ACCEPTED
**Decision:** DEC-046
**Owner Approved:** YES (Owner approval in chat, 2026-10-06; recorded as DEC-046)
**Date:** 2026-10-06
**Applies To:** the current release CBT-R1 (`docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md`)
**Supersedes (for the current release):** DEC-009's selection of InsForge as the initial backend provider; "final technology stack: NOT SELECTED" and "final deployment topology: NOT SELECTED" in `docs/architecture/ARCHITECTURE_TRACEABILITY_AND_EXIT_GATE.md`
**Does Not Supersede:** DEC-009's provider-agnostic principle and modular-monolith direction; DEC-024; DEC-037; DEC-043; 00.07 domain ownership
**Evidence Baseline:** `bad61d2` (branch `claude/laughing-mendel-p2l9gh`)

# ADR-001: As-Built Stack and Self-Hosted Topology for the Current Release

## Context

- The Architecture exit gate (Sequence 7) left the global technology stack and the deployment topology NOT SELECTED. The runtime was then built incrementally from BU-005 onward, and under DEC-042, without a recorded global selection.
- DEC-009 selected InsForge as the initial backend provider. The as-built runtime does not use InsForge.
- DEC-037 selected React, TypeScript and Vite for the frontend.
- Owner direction for CBT-R1: preserve the valid current stack; use the school's existing domain and VPS; Docker, nginx and PostgreSQL; additional recurring cost near zero; no microservices, Kubernetes, Kafka, event sourcing or service mesh without a concrete requirement and Owner approval.

## Decision

The as-built stack is the CBT-R1 stack:

| Layer | Choice | Evidence |
|---|---|---|
| Runtime | Node.js 24 (`engines`: >=24.12 <25); TypeScript executed through Node type stripping and type-checked with `tsc` (TypeScript 7.0.2 in the runtime) | `runtime/*/package.json` |
| HTTP | `node:http`, no web framework; one process serves the API and the built web client from one origin | `runtime/secure-assessment/src/server.ts`, `main.ts` |
| Data access | `pg` 8.23.0 with SQL in the owning domain modules; 53 versioned SQL migrations with an advisory-locked runner and a startup check | `database/migrations/`, `runtime/secure-assessment/src/ops/` |
| Database | PostgreSQL; CI and integration evidence on PostgreSQL 16. The production major version is fixed in P9 and kept identical in staging and CI | `.github/workflows/ci.yml` |
| Modules | modular monolith: identity-access, tenant-access, academic-core, secure-assessment; domain ownership per 00.07 | `runtime/` |
| Web client | React 19, TypeScript, Vite 6, Tailwind CSS 4, shadcn/ui on Radix, Vitest | `frontend/web/` |
| Browser E2E | Playwright 1.56.1, five CI projects | `e2e/` |
| Packaging | one Docker image (`node:24-bookworm-slim`), non-root user, health check | `Dockerfile` |
| Edge | nginx reverse proxy: TLS, HSTS, per-address limits sized for school NAT | `deploy/nginx/` |
| Observability | JSON-lines logs with request ids; Prometheus text-format metrics on an internal listener; alert rules | `runtime/secure-assessment/src/metrics.ts`, `deploy/monitoring/` |
| Hosting | self-hosted on the school's VPS under the school's domain | Owner direction |
| Not used | InsForge or another backend-as-a-service; Redis or Valkey; queues or brokers; Kubernetes; microservices | this ADR |

DEC-009 is reconciled as follows: its provider-agnostic principle and the modular-monolith direction stay; InsForge is not used in CBT-R1; adopting a managed backend later needs a new ADR and Owner approval under the recurring-cost policy.

## Consequences

- **Capacity is unproven.** A single runtime process with the default database pool (`SA_DB_POOL_MAX=10`) has no load evidence for about 1,000 concurrent students. P6 measures and sizes the process count, pool, PostgreSQL settings and VPS resources. Scaling path: tune vertically first; add runtime processes behind nginx only on evidence and after reviewing per-process state (metrics are per process; sessions and exam state live in PostgreSQL).
- **Self-managed operations.** Backup, restore, certificates, monitoring collection and operating-system maintenance are self-managed (P9).
- **Cost.** No new recurring cost beyond the school's domain and VPS.
- **Provenance.** Architecture documents that describe InsForge adapters describe the superseded provider direction and remain for provenance.
- **Tooling note.** The runtime and the web client use different TypeScript major versions (7.0.2 and ^5.7.3). Recorded as-is; aligning them is ordinary maintenance.

## Alternatives considered

- **InsForge or another managed backend:** recurring cost and vendor dependency; school student data on third-party infrastructure (PB-01 and PB-10 implications); not needed for one school.
- **Rewrite to the AICWDF default stack (Laravel and Inertia):** no product gain and a high regression risk to proven answer-integrity code.
- **Kubernetes, microservices or event streaming:** no concrete requirement at one-school scale.

## Acceptance evidence

P6 load evidence and P9 production readiness are the acceptance evidence for this topology. If the load evidence misses the P6 budgets, a follow-up ADR records the change.
