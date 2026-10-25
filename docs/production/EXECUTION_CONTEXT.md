**Status:** ACTIVE (P0, DEC-045; created by GOV-REALIGN-002)
**Canonical:** NO. A navigation aid for executors and reviewers. Every rule here is a pointer; on any conflict the referenced document wins (00.02).
**Last Updated:** 2026-10-26

# ELLIGBLE Execution Context

Read after `AGENTS.md` and `READ_ME_FIRST.md`, before the active Task record (00.12 §4). Live state is never kept here: it lives in the living plan §14, in the Task records and, from the P11 approval, in `docs/production/TASK_PLAN.md`.

## 1. What ELLIGBLE is now

| Item | Value | Authority |
|---|---|---|
| Product | ELLIGBLE Secure Assessment: a mobile-first web CBT platform for one school, about 1,000 concurrent students on Android phones, iPhones, tablets and school PCs | 00.11 (DEC-044) |
| Current release | CBT-R1, Secure Assessment / CBT only; the deferred domains of 00.11 §8 stay out | 00.11 §8, AGENTS.md |
| Roles | Student, Teacher, Proctor, School Operator, Platform Admin; Teacher authority is not Proctor authority without an assignment | 00.11 §4 |
| Stack | as built: Node.js/TypeScript runtime, React/Vite client, PostgreSQL 16, one container behind nginx on the school's own VPS | ADR-001 (DEC-046) |
| Framework | AICWDF v4.3, adapted: phases P0 to P11, one Owner-authorized Task at a time | 00.12 (DEC-045) |
| Engineering priority | answer and data integrity, exam reliability, security and authorization, correctness, device compatibility, operational simplicity, concurrency, maintainability, polish | 00.11 §2 |

## 2. Where the state is

| Question | Where |
|---|---|
| Current phase, active Task, next Task, Owner items, last CI-verified commit | living plan `docs/production/PRODUCTION_COMPLETION_PLAN.md` §14 |
| A Task's contract, status history and evidence | `docs/production/tasks/<TASK-ID>.md` |
| Task baseline and counters | `docs/production/TASK_PLAN.md` (from the P11 approval; until then living plan §6 is planning input) |
| Decisions | `docs/decisions/DECISION_LOG.md`, 00.11 §12 (the CBT-R1 policy decisions OD-05 to OD-09), ADR-001 |
| Verified tools and their limits | `docs/production/TOOLCHAIN.md` |
| Operations, local development, the browser suite | `docs/production/OPERATIONS_RUNBOOK.md` |
| Document index | `docs/DOCUMENT_MANIFEST.md` |

## 3. Executor read path

1. `git status --short --branch` and the 00.04 working-state check; a modified or untracked file is possible work in progress, never cleaned up.
2. `AGENTS.md`, `READ_ME_FIRST.md`, this file.
3. Living plan §14, then the active Task record, then only the documents and sections the Task names, then the relevant source files.
4. The Task's first response (AICWDF §38 form, as the Task record gives it). Continue only when it says SAFE TO IMPLEMENT: YES.

## 4. Rules that stop work

| Rule | Authority |
|---|---|
| Only the Task the Owner authorized by ID, inside its stated scope; a deviation stops the work with one question and a recommended default | 00.12 §4, 00.10 §3 |
| One branch `task/<task-id>-<slug>` from the current `main`, one pull request; the Owner squash-merges; no force push, no rewriting of published history | 00.12 §7 |
| Commits only with the Owner's configured identity; no AI, model or tool attribution in commits, trailers or pull request metadata; after every commit inspect `git log -1 --format=fuller` and the raw message | 00.12 §7 |
| A commit never records its own SHA; one evidence commit per Task changes only its record; the next Task records the landing commit | 00.12 §5 |
| DONE only with the required tests passed and the evidence recorded; HIGH risk also needs an independent review PASS | 00.12 §5 |
| Default deny: server-side authorization for tenant, role, exam, room and participant scope; frontend visibility is never authorization | `docs/02-master-blueprint/02.06_SECURITY_PRIVACY_AND_RISK_BOUNDARIES.md`, `docs/architecture/IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE.md` |
| No production data mutation, reset, reseed or destructive SQL by any coding agent; schema changes only by tested migrations | 00.11 §11, `docs/production/OPERATIONS_RUNBOOK.md` |
| No secret, credential, token or production configuration in the repository or in a Task record | AGENTS.md |
| Risk signals are evidence for human review, never automatic proof of cheating | 00.11 §6 |
| User-facing text in Bahasa Indonesia; shared ELLIGBLE primitives before any new one; every UI change answers the §10.1 question | 00.11 §10, living plan §10.1, DEC-043 |
| No paid service and no new recurring cost without the Owner's approval | 00.11 §9 (G10), ADR-001 |
